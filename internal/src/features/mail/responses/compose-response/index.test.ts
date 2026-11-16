import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { mockRequestCookies } from "@/lib/auth/test-support/cookies";
import { clearSecretCache } from "@/lib/config/secret";
import { fakeRequest } from "../../test-support/fake-request";
import {
	type JmapRequest,
	sessionResource,
	stubJmap,
} from "../../test-support/jmap-stub";

const originalFetch = globalThis.fetch;
const savedEnv = { ...process.env };
const cookies = mockRequestCookies();
const { composeResponse } = await import(".");
const { FALLBACK_COMPOSE_LIMITS } = await import(
	"@/features/mail/schemas/compose-input-limits"
);

/** The request cap the panel held before it asked the server. */
const FALLBACK = FALLBACK_COMPOSE_LIMITS.maxRequestBytes;

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

const message = {
	op: "draft",
	to: [{ email: "b@x.org" }],
	cc: [],
	bcc: [],
	subject: "Hi",
	text: "body",
	attachments: [],
};
const post = (body: unknown, extra = {}) =>
	fakeRequest({
		type: "application/json",
		body: typeof body === "string" ? body : JSON.stringify(body),
		...extra,
	});
const server = (session: Record<string, unknown> | null = sessionResource()) =>
	stubJmap(
		{
			"Identity/get": {
				list: [{ id: "a", name: "Ana", email: "a@x.org" }],
			},
			"Mailbox/get": { list: [{ id: "Drafts", role: "drafts" }] },
			"Email/set": { created: { c: { id: "new-1" } } },
		},
		undefined,
		session,
	);

/** The method calls the stub saw: the session resource is not one. */
const methodCalls = (seen: JmapRequest[]) =>
	seen.filter((request) => request.calls.length > 0);

describe("composeResponse", () => {
	it("saves a draft and answers a closed result, never cached", async () => {
		server(sessionResource());
		const response = await composeResponse(post(message));
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			ok: true,
			result: { kind: "draft", id: "new-1" },
		});
		expect(response.headers.get("cache-control")).toBe("private, no-store");
		expect(response.headers.get("x-content-type-options")).toBe("nosniff");
	});

	it("refuses a request from another origin, with none, or from a null origin, before anything else", async () => {
		const seen = server(sessionResource());
		for (const extra of [
			{ origin: "https://evil.test" },
			{ origin: null },
			{ origin: "null" },
		]) {
			expect((await composeResponse(post(message, extra))).status).toBe(
				403,
			);
		}
		expect(seen).toHaveLength(0);
	});

	it("needs a session", async () => {
		cookies.reset();
		const seen = server(sessionResource());
		expect((await composeResponse(post(message))).status).toBe(401);
		expect(seen).toHaveLength(0);
	});

	it("refuses what is not JSON, does not parse or does not fit the schema", async () => {
		const seen = server(sessionResource());
		expect(
			(await composeResponse(post(message, { type: "text/plain" })))
				.status,
		).toBe(415);
		expect((await composeResponse(post("{not json"))).status).toBe(400);
		for (const bad of [
			{ ...message, op: "delete" },
			{ ...message, extra: 1 },
			{ ...message, to: [{ email: "nope" }] },
			null,
			[],
		]) {
			expect((await composeResponse(post(bad))).status).toBe(400);
		}
		expect(methodCalls(seen)).toHaveLength(0);
	});

	it("reads the limits the mail server publishes, and refuses what it refuses", async () => {
		const seen = server(sessionResource({ maxSizeRequest: 2_000 }));

		expect(
			(await composeResponse(post(message, { length: 2_001 }))).status,
		).toBe(413);
		expect(methodCalls(seen)).toHaveLength(0);
	});

	it("takes what the mail server takes, past the request cap the panel held before", async () => {
		const seen = server(sessionResource({ maxSizeRequest: 10_000_000 }));
		// 800 000 three-byte characters: 2.4 MB, over the 1.5 MB the panel held
		// and under the 10 MB the server publishes.
		const long = JSON.stringify({ ...message, text: "€".repeat(800_000) });

		expect((await composeResponse(post(long))).status).toBe(200);
		expect(methodCalls(seen).length).toBeGreaterThan(0);
	});

	it("refuses past 64 MiB even when the mail server publishes a gigabyte", async () => {
		const seen = server(sessionResource({ maxSizeRequest: 1_073_741_824 }));

		expect(
			(
				await composeResponse(
					post(message, { length: 64 * 1024 * 1024 + 1 }),
				)
			).status,
		).toBe(413);
		expect(methodCalls(seen)).toHaveLength(0);
	});

	it("falls back to the cap it held when the server publishes none", async () => {
		const seen = server(null);
		const long = JSON.stringify({ ...message, text: "€".repeat(800_000) });

		expect((await composeResponse(post(long))).status).toBe(413);
		expect(methodCalls(seen)).toHaveLength(0);
	});

	it("requires a valid Content-Length: a chunked body or a bad number is a 411 and nothing is read", async () => {
		const seen = server(sessionResource());
		for (const length of [null, 0, Number.NaN, -5, 1.5]) {
			expect(
				(await composeResponse(post(message, { length }))).status,
			).toBe(411);
		}
		expect(seen).toHaveLength(0);
	});

	it("stops reading at what was declared: a body longer than its Content-Length is refused", async () => {
		const seen = server(sessionResource());
		const body = JSON.stringify(message);
		expect(
			(await composeResponse(post(body, { length: body.length - 5 })))
				.status,
		).toBe(413);
		expect(methodCalls(seen)).toHaveLength(0);
	});

	it("counts bytes, not characters, and cuts a body past the cap even when it declares the cap", async () => {
		const seen = server(null);
		// 600 000 three-byte characters are 600 000 characters but 1 800 000 bytes.
		const wide = JSON.stringify({ ...message, text: "€".repeat(600_000) });
		expect(wide.length).toBeLessThan(FALLBACK);
		expect(new TextEncoder().encode(wide).byteLength).toBeGreaterThan(
			FALLBACK,
		);
		expect(
			(await composeResponse(post(wide, { length: FALLBACK }))).status,
		).toBe(413);
		expect((await composeResponse(post(wide))).status).toBe(413);
		expect(methodCalls(seen)).toHaveLength(0);
	});

	it("refuses a request with no body stream", async () => {
		server(sessionResource());
		const request = fakeRequest({
			type: "application/json",
			body: JSON.stringify(message),
		}) as unknown as { body: unknown };
		request.body = null;
		expect(
			(await composeResponse(request as unknown as Request)).status,
		).toBe(413);
	});

	it("answers 502 with nothing of the error when JMAP fails, and when the provider has no session", async () => {
		stubJmap({}, undefined, sessionResource());
		const failed = await composeResponse(post(message));
		expect(failed.status).toBe(502);
		expect(await failed.json()).toEqual({
			ok: false,
			reason: "unavailable",
		});
		expect(
			JSON.stringify(
				await composeResponse(post(message)).then((r) => r.json()),
			),
		).not.toContain("unknownMethod");
	});
});

it("refuses the total attachment budget before a mail method call and accepts the exact boundary", async () => {
	const attachment = (size: number) => ({
		blobId: "00000000-0000-4000-a000-000000000001",
		name: "a",
		type: "text/plain",
		size,
	});
	const seen = server(
		sessionResource({ maxSizeAttachmentsPerEmail: 24_000_000 }),
	);
	const response = await composeResponse(
		post({
			...message,
			attachments: [attachment(12_000_000), attachment(12_000_001)],
		}),
	);
	expect(response.status).toBe(413);
	expect(await response.json()).toEqual({
		ok: false,
		reason: "tooLargeAttachments",
		limit: 24_000_000,
	});
	expect(methodCalls(seen)).toHaveLength(0);
	expect(
		(
			await composeResponse(
				post({
					...message,
					attachments: [
						attachment(12_000_000),
						attachment(12_000_000),
					],
				}),
			)
		).status,
	).toBe(200);
	server(null);
	expect(
		(
			await composeResponse(
				post({
					...message,
					attachments: [
						attachment(25_000_000),
						attachment(25_000_000),
					],
				}),
			)
		).status,
	).toBe(200);
});

it("maps HTTP 413 and JMAP requestTooLarge to the message-size outcome", async () => {
	for (const method of [false, true]) {
		server();
		const fetchSession = globalThis.fetch;
		globalThis.fetch = (async (url, init) =>
			String(url).endsWith("/jmap/session")
				? fetchSession(url, init)
				: method
					? new Response(
							JSON.stringify({
								methodResponses: [
									["error", { type: "requestTooLarge" }, "i"],
								],
							}),
						)
					: new Response("request too large", {
							status: 413,
						})) as typeof fetch;
		const response = await composeResponse(
			post({ ...message, op: "send" }),
		);
		expect(response.status).toBe(413);
		expect(await response.json()).toEqual({
			ok: false,
			reason: "tooLarge",
		});
	}
});
