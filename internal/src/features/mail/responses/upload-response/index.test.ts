import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

import { mockRequestCookies } from "@/lib/auth/test-support/cookies";
import { clearSecretCache } from "@/lib/config/secret";
import { fakeRequest } from "../../test-support/fake-request";

const originalFetch = globalThis.fetch;
const savedEnv = { ...process.env };
const cookies = mockRequestCookies();
const { MAX_UPLOAD_BYTES, uploadResponse } = await import(".");

beforeEach(async () => {
	clearSecretCache();
	cookies.reset();
	process.env["EPISTLE_API_URL"] = "http://127.0.0.1:8025";
	process.env["EPISTLE_API_TOKEN"] = "t";
	await cookies.signIn("admin");
});
afterEach(() => {
	process.env = { ...savedEnv };
	globalThis.fetch = originalFetch;
});

type Seen = {
	url: string;
	init: RequestInit;
	/** What the mail server got of the body before it ended or broke off. */
	received: Uint8Array;
	/** The body broke off before its end. */
	brokeOff: boolean;
};
/**
 * The mail server: it reads the body it is sent, as a server does, and answers.
 * A body that breaks off fails the call, as `fetch` does.
 */
function jmap(answer: Response): Seen[] {
	const seen: Seen[] = [];
	globalThis.fetch = mock(async (url: string | URL, init?: RequestInit) => {
		const entry: Seen = {
			url: String(url),
			init: init ?? {},
			received: new Uint8Array(0),
			brokeOff: false,
		};
		seen.push(entry);
		const reader = (
			entry.init.body as ReadableStream<Uint8Array>
		).getReader();
		try {
			for (;;) {
				const { done, value } = await reader.read();
				if (done) {
					break;
				}
				const joined = new Uint8Array(
					entry.received.byteLength + value.byteLength,
				);
				joined.set(entry.received);
				joined.set(value, entry.received.byteLength);
				entry.received = joined;
			}
		} catch (cause) {
			entry.brokeOff = true;
			throw new TypeError("fetch failed", { cause });
		}
		return answer.clone();
	}) as unknown as typeof fetch;
	return seen;
}
/** A header the upload carried to the mail server. */
function sentHeader(seen: Seen[], name: string): string | undefined {
	return (seen[0]?.init.headers as Record<string, string> | undefined)?.[
		name
	];
}
const stored = () =>
	new Response(
		JSON.stringify({
			blobId: "00000000-0000-4000-a000-000000000001",
			size: 5,
			type: "application/pdf",
		}),
		{ headers: { "content-type": "application/json" } },
	);
const upload = (extra = {}) =>
	fakeRequest({
		url: "https://panel.test/app/mail/upload?name=report.pdf",
		type: "application/pdf",
		body: "hello",
		...extra,
	});
/** The same request, counting every time its body is touched. */
function watched(request: Request) {
	const touched = { times: 0 };
	const body = request.body;
	const watchedRequest = {
		url: request.url,
		headers: request.headers,
		get body() {
			touched.times += 1;
			return body;
		},
		arrayBuffer: async () => {
			touched.times += 1;
			return new ArrayBuffer(0);
		},
	} as unknown as Request;
	return { request: watchedRequest, touched };
}

describe("uploadResponse", () => {
	it("stores the file for the session's account with its declared type and answers the blob id and a clean name", async () => {
		const seen = jmap(stored());
		const response = await uploadResponse(upload());
		expect(await response.json()).toEqual({
			ok: true,
			attachment: {
				blobId: "00000000-0000-4000-a000-000000000001",
				size: 5,
				type: "application/pdf",
				name: "report.pdf",
			},
		});
		expect(seen[0]?.url).toBe("http://127.0.0.1:8025/jmap/upload/admin");
		expect(sentHeader(seen, "Authorization")).toBe("Bearer t");
		expect(sentHeader(seen, "Content-Type")).toBe("application/pdf");
		expect(seen[0]?.init.redirect).toBe("error");
	});

	it("hands the body on as a stream of the declared length, whole, and never reads it into memory", async () => {
		const seen = jmap(stored());
		const bytes = new Uint8Array(100_000).map((_, at) => at % 251);
		const { request, touched } = watched(upload({ body: bytes }));

		expect((await uploadResponse(request)).status).toBe(200);

		expect(seen[0]?.init.body).toBeInstanceOf(ReadableStream);
		expect((seen[0]?.init as { duplex?: string } | undefined)?.duplex).toBe(
			"half",
		);
		expect(sentHeader(seen, "Content-Length")).toBe("100000");
		expect(seen[0]?.received).toEqual(bytes);
		// Its `body` is taken once, to pass on; `arrayBuffer` would be a second touch.
		expect(touched.times).toBe(2);
	});

	it("cleans the name and drops the parameters of the type and falls back to octet-stream for one that is not plain type/subtype", async () => {
		jmap(stored());
		const hostile = await (
			await uploadResponse(
				upload({
					url: "https://panel.test/app/mail/upload?name=..%2F..%2Fx%22%0D%0Aevil%E2%80%AE.html",
					type: "text/html; charset=utf-8; x=<script>",
				}),
			)
		).json();
		expect(hostile.attachment.name).toBe("x_ evil.html");
		expect(hostile.attachment.type).toBe("text/html");
		jmap(stored());
		const garbage = await (
			await uploadResponse(upload({ type: "garbage<script>" }))
		).json();
		expect(garbage.attachment.type).toBe("application/octet-stream");
		const none = await (
			await uploadResponse(
				upload({
					url: "https://panel.test/app/mail/upload",
					type: undefined,
				}),
			)
		).json();
		expect(none.attachment).toMatchObject({
			name: "attachment",
			type: "application/octet-stream",
		});
	});

	it("refuses another origin, a missing session and a size it will not take without touching the body or the mail server", async () => {
		const seen = jmap(stored());
		const refused = async (extra: object, signedIn = true) => {
			if (!signedIn) {
				cookies.reset();
			}
			const { request, touched } = watched(upload(extra));
			const response = await uploadResponse(request);
			return [response.status, touched.times];
		};

		expect(await refused({ origin: "https://evil.test" })).toEqual([
			403, 0,
		]);
		expect(await refused({ origin: null })).toEqual([403, 0]);
		expect(await refused({ length: 0 })).toEqual([411, 0]);
		expect(await refused({ length: Number.NaN })).toEqual([411, 0]);
		expect(await refused({ length: 4.5 })).toEqual([411, 0]);
		expect(await refused({ length: null })).toEqual([411, 0]);
		// One byte over 25 MiB.
		expect(await refused({ length: 26_214_401 })).toEqual([413, 0]);
		expect(await refused({}, false)).toEqual([401, 0]);
		expect(seen).toHaveLength(0);
	});

	it("takes a file of exactly 25 MiB by its declared size", async () => {
		expect(MAX_UPLOAD_BYTES).toBe(26_214_400);
		const seen = jmap(stored());
		// The declared size is what is checked; the body here is short on purpose,
		// so the case does not move 25 MiB: it ends as a mismatch, past the check.
		const response = await uploadResponse(
			upload({ body: "hello", length: 26_214_400 }),
		);
		expect(response.status).toBe(400);
		expect(seen).toHaveLength(1);
	});

	it("says invalid when the body is not the size it declared, and hands on no byte past that size", async () => {
		let seen = jmap(stored());
		const short = await uploadResponse(upload({ body: "hel", length: 5 }));
		expect(short.status).toBe(400);
		expect(await short.json()).toEqual({ ok: false, reason: "invalid" });
		expect(seen[0]?.brokeOff).toBe(true);

		seen = jmap(stored());
		const long = await uploadResponse(
			upload({ body: new Uint8Array(50_000), length: 20_000 }),
		);
		expect(long.status).toBe(400);
		expect(seen[0]?.brokeOff).toBe(true);
		expect(seen[0]?.received.byteLength).toBeLessThanOrEqual(20_000);

		seen = jmap(stored());
		const empty = await uploadResponse(upload({ body: "", length: 5 }));
		expect(empty.status).toBe(400);
		expect(seen[0]?.brokeOff).toBe(true);
	});

	it("stops reading the file when the mail server stops taking it", async () => {
		let stopped: unknown;
		const source = new ReadableStream<Uint8Array>({
			pull(controller) {
				controller.enqueue(new Uint8Array(16_384));
			},
			cancel(reason) {
				stopped = reason;
			},
		});
		// A server that refuses at the headers and lets go of the body.
		globalThis.fetch = mock(
			async (_url: string | URL, init?: RequestInit) => {
				await (
					init?.body as ReadableStream<Uint8Array> | undefined
				)?.cancel("refused");
				return new Response("{}", { status: 413 });
			},
		) as unknown as typeof fetch;
		const request = {
			...upload({ length: 1_000_000 }),
			body: source,
		} as unknown as Request;

		expect((await uploadResponse(request)).status).toBe(413);
		expect(stopped).toBe("refused");
	});

	it("refuses a request with no body at all", async () => {
		const seen = jmap(stored());
		const request = { ...upload(), body: null } as unknown as Request;
		expect((await uploadResponse(request)).status).toBe(400);
		expect(seen).toHaveLength(0);
	});

	it("says too large when the mail server refuses for size or quota, busy when it has its fill of uploads, and 502 for any other failure", async () => {
		jmap(new Response("{}", { status: 413 }));
		expect((await uploadResponse(upload())).status).toBe(413);
		jmap(new Response("{}", { status: 507 }));
		expect((await uploadResponse(upload())).status).toBe(413);
		jmap(new Response("{}", { status: 429 }));
		const busy = await uploadResponse(upload());
		expect(busy.status).toBe(429);
		expect(await busy.json()).toEqual({ ok: false, reason: "busy" });
		jmap(new Response("{}", { status: 500 }));
		expect((await uploadResponse(upload())).status).toBe(502);
		jmap(new Response(JSON.stringify({ nope: 1 })));
		expect((await uploadResponse(upload())).status).toBe(502);
	});

	it("sends its own headers on every answer, since the proxy does not cover this route", async () => {
		jmap(stored());
		cookies.reset();
		const answers = [
			await uploadResponse(upload({ origin: "https://evil.test" })),
			await uploadResponse(upload()),
		];
		await cookies.signIn("admin");
		answers.push(await uploadResponse(upload()));
		expect(answers.map((r) => r.status)).toEqual([403, 401, 200]);
		for (const response of answers) {
			expect(response.headers.get("content-security-policy")).toBe(
				"default-src 'none'; frame-ancestors 'none'",
			);
			expect(response.headers.get("x-content-type-options")).toBe(
				"nosniff",
			);
			expect(response.headers.get("cache-control")).toBe(
				"private, no-store",
			);
			expect(response.headers.get("content-type")).toBe(
				"application/json",
			);
		}
	});
});
