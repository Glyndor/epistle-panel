import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { z } from "zod";

import {
	EpistleApiResponseTooLargeError,
	EpistleApiTimeoutError,
} from "@/lib/api/error";
import {
	stubFetchHang,
	stubFetchJson,
	stubFetchResponse,
	stubFetchStalledBody,
} from "@/lib/api/test-support/fetch";
import { SESSION, stubJmap } from "../../test-support/jmap-stub";
import { downloadBlob, JmapError, jmapCall, methodResult } from ".";

const originalFetch = globalThis.fetch;
const savedEnv = { ...process.env };
const env = { ...process.env };

beforeEach(() => {
	process.env["EPISTLE_API_URL"] = "http://127.0.0.1:8025";
});
afterEach(() => {
	process.env = { ...savedEnv };
	globalThis.fetch = originalFetch;
	process.env = { ...env };
});

describe("jmapCall", () => {
	it("posts the calls to /jmap/api with the session's bearer and no cache", async () => {
		const seen = stubJmap({ "Core/echo": { hello: "world" } });

		const responses = await jmapCall(SESSION, [
			["Core/echo", { hello: "world" }, "c1"],
		]);

		expect(responses).toEqual([["Core/echo", { hello: "world" }, "c1"]]);
		expect(seen[0]?.url).toBe("http://127.0.0.1:8025/jmap/api");
		expect(seen[0]?.method).toBe("POST");
		expect(seen[0]?.authorization).toBe("Bearer test-bearer");
		const [, init] =
			(
				globalThis.fetch as unknown as {
					mock: { calls: [unknown, RequestInit][] };
				}
			).mock.calls[0] ?? [];
		expect(init?.redirect).toBe("error");
		expect(init?.cache).toBe("no-store");
		expect(JSON.parse(String(init?.body)).using).toEqual([
			"urn:ietf:params:jmap:core",
			"urn:ietf:params:jmap:mail",
		]);
	});

	it("turns a non-2xx answer into an http error naming only the status", async () => {
		stubFetchJson({ error: { message: "secret detail" } }, 401);
		const error = await jmapCall(SESSION, []).catch((e) => e);
		expect(error).toBeInstanceOf(JmapError);
		expect(error.failure).toBe("http");
		expect(error.detail).toBe("401");
		expect(error.message).not.toContain("secret");
	});

	it("reads a 404 as not found", async () => {
		stubFetchJson({}, 404);
		expect((await jmapCall(SESSION, []).catch((e) => e)).failure).toBe(
			"notFound",
		);
	});

	it("refuses an answer that is not a JMAP response", async () => {
		stubFetchJson({ nope: true });
		expect((await jmapCall(SESSION, []).catch((e) => e)).failure).toBe(
			"shape",
		);
		stubFetchJson({ methodResponses: [["x", "not-an-object", "c"]] });
		expect((await jmapCall(SESSION, []).catch((e) => e)).failure).toBe(
			"shape",
		);
	});

	it("times out when the server never answers or the body stalls", async () => {
		stubFetchHang();
		expect(await jmapCall(SESSION, [], 30).catch((e) => e)).toBeInstanceOf(
			EpistleApiTimeoutError,
		);
		stubFetchStalledBody();
		expect(await jmapCall(SESSION, [], 30).catch((e) => e)).toBeInstanceOf(
			EpistleApiTimeoutError,
		);
	});

	it("does not turn a network failure into a timeout", async () => {
		globalThis.fetch = (async () => {
			throw new TypeError("network");
		}) as unknown as typeof fetch;
		expect(await jmapCall(SESSION, []).catch((e) => e)).toBeInstanceOf(
			TypeError,
		);
	});

	it("refuses a body over the response cap", async () => {
		stubFetchResponse(
			new Response("x", {
				headers: { "content-length": String(6 * 1024 * 1024) },
			}),
		);
		expect(await jmapCall(SESSION, []).catch((e) => e)).toBeInstanceOf(
			EpistleApiResponseTooLargeError,
		);
	});

	it("sends nothing when the API address is refused", async () => {
		process.env["EPISTLE_API_URL"] = "http://169.254.169.254";
		stubJmap({});
		expect(await jmapCall(SESSION, []).catch((e) => e)).toBeInstanceOf(
			Error,
		);
		expect(
			(globalThis.fetch as unknown as { mock: { calls: unknown[] } }).mock
				.calls,
		).toHaveLength(0);
	});
});

describe("methodResult", () => {
	const schema = z.object({ n: z.number() });

	it("returns the arguments of the named call, checked", () => {
		expect(
			methodResult(
				[["M/x", { n: 1, extra: 2 }, "a"]],
				"a",
				"M/x",
				schema,
			),
		).toEqual({ n: 1 });
	});

	it("throws a method error carrying only a closed type", () => {
		let error: JmapError | undefined;
		try {
			methodResult(
				[["error", { type: "accountNotFound" }, "a"]],
				"a",
				"M/x",
				schema,
			);
		} catch (e) {
			error = e as JmapError;
		}
		expect(error?.failure).toBe("method");
		expect(error?.detail).toBe("accountNotFound");
		for (const type of ["a b", "x".repeat(60), 5, undefined]) {
			expect(() =>
				methodResult([["error", { type }, "a"]], "a", "M/x", schema),
			).toThrow("unknown");
		}
	});

	it("throws when the call is missing, answered by another method, or the data does not fit", () => {
		expect(() => methodResult([], "a", "M/x", schema)).toThrow(
			"missing response",
		);
		expect(() =>
			methodResult([["M/y", { n: 1 }, "a"]], "a", "M/x", schema),
		).toThrow("unexpected method");
		expect(() =>
			methodResult([["M/x", { n: "1" }, "a"]], "a", "M/x", schema),
		).toThrow("M/x");
	});
});

describe("downloadBlob", () => {
	it("downloads one blob with a fixed label in the URL and returns the recorded type", async () => {
		const seen = stubJmap(
			{},
			new Response("hello", {
				headers: { "content-type": "text/plain" },
			}),
		);
		const blob = await downloadBlob(SESSION, "abc.1", 100);
		expect(new TextDecoder().decode(blob.bytes)).toBe("hello");
		expect(blob.type).toBe("text/plain");
		expect(seen[0]?.url).toBe(
			"http://127.0.0.1:8025/jmap/download/admin/abc.1/blob",
		);
		expect(seen[0]?.authorization).toBe("Bearer test-bearer");
	});

	it("percent-encodes the account and the blob id so neither can change the path", async () => {
		const seen = stubJmap({}, new Response(""));
		await downloadBlob({ ...SESSION, accountId: "a/b" }, "../x?y#z", 10);
		expect(seen[0]?.url).toBe(
			"http://127.0.0.1:8025/jmap/download/a%2Fb/..%2Fx%3Fy%23z/blob",
		);
	});

	it("answers not found for a 404 and http for another refusal", async () => {
		stubJmap({});
		expect(
			(await downloadBlob(SESSION, "x", 10).catch((e) => e)).failure,
		).toBe("notFound");
		stubFetchResponse(new Response("no", { status: 502 }));
		const error = await downloadBlob(SESSION, "x", 10).catch((e) => e);
		expect([error.failure, error.detail]).toEqual(["http", "502"]);
	});

	it("refuses a blob over the cap, by its declared size and by what the stream carries", async () => {
		stubFetchResponse(
			new Response("x", { headers: { "content-length": "999" } }),
		);
		expect(
			(await downloadBlob(SESSION, "x", 10).catch((e) => e)).detail,
		).toBe("blob too large");
		stubFetchResponse(new Response("x".repeat(50)));
		expect(
			(await downloadBlob(SESSION, "x", 10).catch((e) => e)).detail,
		).toBe("blob too large");
	});

	it("reads a body that arrives in several chunks and an empty one", async () => {
		const chunks = new ReadableStream<Uint8Array>({
			start(controller) {
				controller.enqueue(new TextEncoder().encode("ab"));
				controller.enqueue(new TextEncoder().encode("cd"));
				controller.close();
			},
		});
		stubFetchResponse(new Response(chunks));
		expect(
			new TextDecoder().decode(
				(await downloadBlob(SESSION, "x", 10)).bytes,
			),
		).toBe("abcd");
		stubFetchResponse(new Response(null));
		expect((await downloadBlob(SESSION, "x", 10)).bytes).toHaveLength(0);
	});

	it("times out when the server stalls", async () => {
		stubFetchHang();
		expect(
			await downloadBlob(SESSION, "x", 10, 30).catch((e) => e),
		).toBeInstanceOf(EpistleApiTimeoutError);
	});
});
