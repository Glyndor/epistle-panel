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

type Seen = { url: string; init: RequestInit };
function jmap(answer: Response): Seen[] {
	const seen: Seen[] = [];
	globalThis.fetch = mock(async (url: string | URL, init?: RequestInit) => {
		seen.push({ url: String(url), init: init ?? {} });
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

	it("refuses a request from another origin and one without a session, before any upload", async () => {
		const seen = jmap(stored());
		expect(
			(await uploadResponse(upload({ origin: "https://evil.test" })))
				.status,
		).toBe(403);
		expect((await uploadResponse(upload({ origin: null }))).status).toBe(
			403,
		);
		cookies.reset();
		expect((await uploadResponse(upload())).status).toBe(401);
		expect(seen).toHaveLength(0);
	});

	it("needs a declared size, refuses an empty body and one over 25 MiB, by what is declared and what arrives", async () => {
		const seen = jmap(stored());
		expect((await uploadResponse(upload({ length: 0 }))).status).toBe(411);
		expect(
			(await uploadResponse(upload({ length: Number.NaN }))).status,
		).toBe(411);
		const big = await uploadResponse(
			upload({ length: MAX_UPLOAD_BYTES + 1 }),
		);
		expect(big.status).toBe(413);
		expect(await big.json()).toEqual({ ok: false, reason: "tooLarge" });
		expect(
			(await uploadResponse(upload({ body: "", length: 5 }))).status,
		).toBe(400);
		expect(
			(
				await uploadResponse(
					upload({
						body: new Uint8Array(MAX_UPLOAD_BYTES + 1),
						length: 5,
					}),
				)
			).status,
		).toBe(413);
		expect(seen).toHaveLength(0);
	});

	it("says too large when the mail server refuses for size or quota and 502 for any other failure", async () => {
		jmap(new Response("{}", { status: 413 }));
		expect((await uploadResponse(upload())).status).toBe(413);
		jmap(new Response("{}", { status: 507 }));
		expect((await uploadResponse(upload())).status).toBe(413);
		jmap(new Response("{}", { status: 500 }));
		expect((await uploadResponse(upload())).status).toBe(502);
		jmap(new Response(JSON.stringify({ nope: 1 })));
		expect((await uploadResponse(upload())).status).toBe(502);
	});
});
