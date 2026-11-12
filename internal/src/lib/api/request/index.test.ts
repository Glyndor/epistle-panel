import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	type Mock,
} from "bun:test";
import { z } from "zod";

import {
	EpistleApiError,
	EpistleApiResponseTooLargeError,
	EpistleApiTimeoutError,
} from "../error";
import {
	type ChunkCounter,
	stubFetchHang,
	stubFetchJson,
	stubFetchResponse,
	stubFetchStalledBody,
	zeroStream,
} from "../test-support/fetch";
import { REQUEST_TIMEOUT_MS, request } from ".";

const schema = z.object({ ok: z.boolean() });

function fetchMock(): Mock<typeof fetch> {
	return globalThis.fetch as unknown as Mock<typeof fetch>;
}

beforeEach(() => {
	process.env.EPISTLE_API_TOKEN = "test-token";
	process.env.EPISTLE_API_URL = "http://127.0.0.1:8025";
});

afterEach(() => {
	delete process.env.EPISTLE_API_TOKEN_FILE;
	delete process.env.EPISTLE_API_ALLOW_HTTP_HOSTS;
	process.env.EPISTLE_API_URL = "http://127.0.0.1:8025";
	process.env.EPISTLE_API_TOKEN = "test-token";
});

describe("request headers", () => {
	/** Headers of the single call `fetch` received, as a `Headers`. */
	function sentHeaders(): Headers {
		const call = fetchMock().mock.calls[0];
		const init = (call?.[1] ?? {}) as RequestInit;
		return new Headers(init.headers);
	}

	it("sends the bearer token and Accept with a plain object", async () => {
		stubFetchJson({ ok: true });

		await request("/x", schema, { headers: { "X-Trace": "a" } });

		expect(sentHeaders().get("authorization")).toBe("Bearer test-token");
		expect(sentHeaders().get("accept")).toBe("application/json");
		expect(sentHeaders().get("x-trace")).toBe("a");
	});

	it("keeps the headers of a Headers instance", async () => {
		stubFetchJson({ ok: true });

		await request("/x", schema, {
			headers: new Headers({
				"Content-Type": "application/json",
				"X-Trace": "b",
			}),
		});

		expect(sentHeaders().get("content-type")).toBe("application/json");
		expect(sentHeaders().get("x-trace")).toBe("b");
		expect(sentHeaders().get("authorization")).toBe("Bearer test-token");
	});

	it("keeps the headers of a list of pairs", async () => {
		stubFetchJson({ ok: true });

		await request("/x", schema, {
			headers: [
				["Content-Type", "application/json"],
				["X-Trace", "c"],
			],
		});

		expect(sentHeaders().get("content-type")).toBe("application/json");
		expect(sentHeaders().get("x-trace")).toBe("c");
		expect(sentHeaders().get("accept")).toBe("application/json");
	});

	it("lets the caller override neither Authorization nor Accept", async () => {
		stubFetchJson({ ok: true });

		await request("/x", schema, {
			headers: new Headers({
				authorization: "Bearer other",
				accept: "text/html",
			}),
		});

		expect(sentHeaders().get("authorization")).toBe("Bearer test-token");
		expect(sentHeaders().get("accept")).toBe("application/json");
	});
});

describe("request time budget", () => {
	it("defaults to ten seconds", () => {
		expect(REQUEST_TIMEOUT_MS).toBe(10_000);
	});

	it("passes a timeout signal built from the budget to fetch", async () => {
		stubFetchJson({ ok: true });
		const timeout = AbortSignal.timeout;
		const seen: number[] = [];
		AbortSignal.timeout = (ms: number) => {
			seen.push(ms);
			return timeout.call(AbortSignal, ms);
		};
		try {
			await request("/x", schema);
			await request("/x", schema, undefined, 1234);
		} finally {
			AbortSignal.timeout = timeout;
		}
		expect(seen).toEqual([REQUEST_TIMEOUT_MS, 1234]);
		const [, init] = fetchMock().mock.calls[0] as [unknown, RequestInit];
		expect(init.signal).toBeInstanceOf(AbortSignal);
	});

	it("rejects with a timeout error when the API never answers", async () => {
		stubFetchHang();
		const started = Date.now();
		const error = await request("/x", schema, undefined, 30).catch(
			(e) => e,
		);
		expect(error).toBeInstanceOf(EpistleApiTimeoutError);
		expect(Date.now() - started).toBeLessThan(2000);
	});

	it("rejects with a timeout error when the body stalls after the headers", async () => {
		stubFetchStalledBody();
		const error = await request("/x", schema, undefined, 30).catch(
			(e) => e,
		);
		expect(error).toBeInstanceOf(EpistleApiTimeoutError);
	});

	it("does not turn a network failure into a timeout", async () => {
		globalThis.fetch = (async () => {
			throw new TypeError("network error");
		}) as unknown as typeof fetch;
		const error = await request("/x", schema).catch((e) => e);
		expect(error).toBeInstanceOf(TypeError);
	});

	it("does not turn an oversized body into a timeout", async () => {
		const counter: ChunkCounter = { pulled: 0 };
		stubFetchResponse(new Response(zeroStream(800, 64 * 1024, counter)));
		const error = await request("/x", schema).catch((e) => e);
		expect(error).toBeInstanceOf(EpistleApiResponseTooLargeError);
	});
});

describe("request response handling", () => {
	it("refuses a redirect instead of following it", async () => {
		stubFetchJson({ ok: true });
		await request("/x", schema);
		const [, init] = fetchMock().mock.calls[0] as [unknown, RequestInit];
		expect(init.redirect).toBe("error");
	});

	it("rejects an oversized error body too", async () => {
		const counter: ChunkCounter = { pulled: 0 };
		stubFetchResponse(
			new Response(zeroStream(800, 64 * 1024, counter), { status: 500 }),
		);
		const error = await request("/x", schema).catch((e) => e);
		expect(error).toBeInstanceOf(EpistleApiResponseTooLargeError);
	});

	it("maps a non-2xx answer to EpistleApiError", async () => {
		stubFetchJson({ error: { code: "denied", message: "no" } }, 403);
		const error = await request("/x", schema).catch((e) => e);
		expect(error).toBeInstanceOf(EpistleApiError);
		expect(error.code).toBe("denied");
	});
});

describe("request base URL", () => {
	const refused = [
		"http://169.254.169.254",
		"http://[fe80::1]:8025",
		"http://api.remoto:8025",
		"ftp://127.0.0.1:8025",
		"http://user:pass@127.0.0.1:8025",
	];
	for (const url of refused) {
		it(`sends nothing when EPISTLE_API_URL is ${url}`, async () => {
			process.env.EPISTLE_API_URL = url;
			stubFetchJson({ ok: true });
			const error = await request("/x", schema).catch((e) => e);
			expect(error.message).toContain("EPISTLE_API_URL");
			expect(error.message).not.toContain("test-token");
			expect(error.message).not.toContain("pass");
			expect(globalThis.fetch).not.toHaveBeenCalled();
		});
	}

	it("does not read the token for a refused URL", async () => {
		process.env.EPISTLE_API_URL = "http://169.254.169.254";
		process.env.EPISTLE_API_TOKEN_FILE = "/nonexistent/token";
		stubFetchJson({ ok: true });
		const error = await request("/x", schema).catch((e) => e);
		expect(error.message).toContain("EPISTLE_API_URL");
		expect(error.message).not.toContain("EPISTLE_API_TOKEN_FILE");
	});

	it("keeps working against the default loopback URL", async () => {
		delete process.env.EPISTLE_API_URL;
		stubFetchJson({ ok: true });
		await request("/api/v1/status", schema);
		expect(fetchMock().mock.calls[0]?.[0]).toBe(
			"http://127.0.0.1:8025/api/v1/status",
		);
	});

	it("sends to an https URL and to an allowed private http host", async () => {
		process.env.EPISTLE_API_URL = "https://api.example.org:8443";
		stubFetchJson({ ok: true });
		await request("/x", schema);
		expect(fetchMock().mock.calls[0]?.[0]).toBe(
			"https://api.example.org:8443/x",
		);

		process.env.EPISTLE_API_URL = "http://node2.wg:8025";
		process.env.EPISTLE_API_ALLOW_HTTP_HOSTS = "node2.wg";
		stubFetchJson({ ok: true });
		await request("/x", schema);
		expect(fetchMock().mock.calls[0]?.[0]).toBe("http://node2.wg:8025/x");
	});
});
