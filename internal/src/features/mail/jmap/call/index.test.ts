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
import { JmapError, jmapCall, methodResult, openBlob } from ".";

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

/** Read a stream to its end. */
async function drain(body: ReadableStream<Uint8Array>): Promise<string> {
	const reader = body.getReader();
	let text = "";
	for (;;) {
		const { done, value } = await reader.read();
		if (done) {
			return text;
		}
		text += new TextDecoder().decode(value);
	}
}
/** The error a call ends with; a call that does not fail is one with the failure `none`. */
const failure = (run: Promise<unknown>): Promise<JmapError> =>
	run.then(
		() => new JmapError("shape", "none"),
		(error: unknown) => error as JmapError,
	);

describe("openBlob", () => {
	it("opens one blob with a fixed label in the URL and gives its octets, its recorded type and its declared size", async () => {
		const seen = stubJmap(
			{},
			new Response("hello", {
				headers: {
					"content-type": "text/plain",
					"content-length": "5",
				},
			}),
		);
		const blob = await openBlob(SESSION, "abc.1", 100);
		expect(blob.type).toBe("text/plain");
		expect(blob.length).toBe(5);
		expect(await drain(blob.body)).toBe("hello");
		expect(seen[0]?.url).toBe(
			"http://127.0.0.1:8025/jmap/download/admin/abc.1/blob",
		);
		expect(seen[0]?.authorization).toBe("Bearer test-bearer");
	});

	it("percent-encodes the account and the blob id so neither can change the path", async () => {
		const seen = stubJmap({}, new Response(""));
		await openBlob({ ...SESSION, accountId: "a/b" }, "../x?y#z", 10);
		expect(seen[0]?.url).toBe(
			"http://127.0.0.1:8025/jmap/download/a%2Fb/..%2Fx%3Fy%23z/blob",
		);
	});

	it("answers not found for a 404 and http for another refusal", async () => {
		stubJmap({});
		expect((await failure(openBlob(SESSION, "x", 10))).failure).toBe(
			"notFound",
		);
		stubFetchResponse(new Response("no", { status: 502 }));
		const error = await failure(openBlob(SESSION, "x", 10));
		expect([error.failure, error.detail]).toEqual(["http", "502"]);
	});

	it("refuses a blob that declares more than the cap before a byte of it is passed on", async () => {
		stubFetchResponse(
			new Response("x", { headers: { "content-length": "11" } }),
		);
		expect((await failure(openBlob(SESSION, "x", 10))).detail).toBe(
			"blob too large",
		);
		// At the cap it is taken.
		stubFetchResponse(
			new Response("0123456789", { headers: { "content-length": "10" } }),
		);
		expect(await drain((await openBlob(SESSION, "x", 10)).body)).toBe(
			"0123456789",
		);
	});

	it("breaks the download off at the byte past the cap when the blob did not say how long it is", async () => {
		const chunks = new ReadableStream<Uint8Array>({
			start(controller) {
				for (let n = 0; n < 6; n++) {
					controller.enqueue(new TextEncoder().encode("abcd"));
				}
				controller.close();
			},
		});
		stubFetchResponse(new Response(chunks));
		const blob = await openBlob(SESSION, "x", 10);
		expect(blob.length).toBeNull();

		const reader = blob.body.getReader();
		let passed = 0;
		const ended = await (async () => {
			for (;;) {
				const { done, value } = await reader.read();
				if (done) {
					return "ended as if whole";
				}
				passed += value.byteLength;
			}
		})().catch((error: JmapError) => error.detail);

		expect(ended).toBe("blob too large");
		expect(passed).toBe(8);
	});

	it("holds a blob to the size it declared: not a byte more is passed on, and a short one fails instead of ending", async () => {
		const chunked = (parts: string[]) =>
			new ReadableStream<Uint8Array>({
				start(controller) {
					for (const part of parts) {
						controller.enqueue(new TextEncoder().encode(part));
					}
					controller.close();
				},
			});
		const read = async (parts: string[], declared: string) => {
			stubFetchResponse(
				new Response(chunked(parts), {
					headers: { "content-length": declared },
				}),
			);
			const blob = await openBlob(SESSION, "x", 100);
			const reader = blob.body.getReader();
			let passed = "";
			for (;;) {
				const step = await reader.read().catch((e: JmapError) => e);
				if (step instanceof JmapError) {
					return [passed, step.detail];
				}
				if (step.done) {
					return [passed, "ended"];
				}
				passed += new TextDecoder().decode(step.value);
			}
		};

		expect(await read(["abcd", "efgh"], "8")).toEqual([
			"abcdefgh",
			"ended",
		]);
		expect(await read(["abcd", "efgh", "ij"], "8")).toEqual([
			"abcdefgh",
			"blob longer than declared",
		]);
		expect(await read(["abcd", "efgh"], "6")).toEqual([
			"abcd",
			"blob longer than declared",
		]);
		expect(await read(["abcd"], "8")).toEqual([
			"abcd",
			"blob shorter than declared",
		]);
		expect(await read([], "3")).toEqual(["", "blob shorter than declared"]);
	});

	it("does not hold a declared size it cannot read as a count", async () => {
		for (const header of ["abc", "-1", "1e3", "5, 5", ""]) {
			stubFetchResponse(
				new Response("hello", {
					headers: { "content-length": header },
				}),
			);
			expect([header, (await openBlob(SESSION, "x", 10)).length]).toEqual(
				[header, null],
			);
		}
	});

	it("reads from the mail server only what the reader asks for", async () => {
		let asked = 0;
		const source = new ReadableStream<Uint8Array>(
			{
				pull(controller) {
					asked += 1;
					controller.enqueue(new Uint8Array(1000));
				},
			},
			{ highWaterMark: 0 },
		);
		stubFetchResponse(new Response(source));
		const blob = await openBlob(SESSION, "x", 1_000_000);
		const reader = blob.body.getReader();
		await reader.read();
		await reader.read();

		// Two chunks were read; a chunk or two more may be waiting, never the file.
		expect(asked).toBeGreaterThanOrEqual(2);
		expect(asked).toBeLessThanOrEqual(4);
		await reader.cancel();
	});

	it("gives an empty stream for an answer with no body", async () => {
		stubFetchResponse(new Response(null));
		expect(await drain((await openBlob(SESSION, "x", 10)).body)).toBe("");
	});

	it("times out when the headers do not come", async () => {
		stubFetchHang();
		expect(
			await openBlob(SESSION, "x", 10, 30).catch((e: unknown) => e),
		).toBeInstanceOf(EpistleApiTimeoutError);
	});

	it("breaks the download off when it stands still, and not while octets keep coming", async () => {
		// The headers come at once and no octet follows.
		stubFetchStalledBody();
		const stalled = await openBlob(SESSION, "x", 10, 1000, 30);
		const started = Date.now();
		const outcome = await drain(stalled.body).catch(() => "broken off");
		expect(outcome).toBe("broken off");
		expect(Date.now() - started).toBeLessThan(500);

		// A slow download that never stands still for the idle time is let finish,
		// though it takes longer than the idle time in all.
		// As `fetch` does, the body fails when the call is aborted.
		let fail: (reason: unknown) => void = () => {};
		const slow = new ReadableStream<Uint8Array>({
			async start(controller) {
				let failed = false;
				fail = (reason) => {
					failed = true;
					controller.error(reason);
				};
				for (let n = 0; n < 5 && !failed; n++) {
					await new Promise((resolve) => setTimeout(resolve, 15));
					if (!failed) {
						controller.enqueue(new TextEncoder().encode("ab"));
					}
				}
				if (!failed) {
					controller.close();
				}
			},
		});
		globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
			init?.signal?.addEventListener("abort", () =>
				fail(init.signal?.reason),
			);
			return new Response(slow);
		}) as unknown as typeof fetch;
		const steady = await openBlob(SESSION, "x", 100, 1000, 40);
		expect(await drain(steady.body)).toBe("ababababab");
	});

	it("lets go of the mail server when the reader stops, and sets no timer against a download that is over", async () => {
		let stopped: unknown;
		let signal: AbortSignal | undefined;
		const source = new ReadableStream<Uint8Array>({
			pull(controller) {
				controller.enqueue(new Uint8Array(10));
			},
			cancel(reason) {
				stopped = reason;
			},
		});
		globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
			signal = init?.signal ?? undefined;
			return new Response(source);
		}) as unknown as typeof fetch;
		const blob = await openBlob(SESSION, "x", 1000, 1000, 20);
		const reader = blob.body.getReader();
		await reader.read();
		await reader.cancel("reader left");

		expect(stopped).toBe("reader left");
		await new Promise((resolve) => setTimeout(resolve, 60));
		expect(signal?.aborted).toBe(false);
	});
});
