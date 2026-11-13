import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { mockRequestCookies } from "@/lib/auth/test-support/cookies";
import { clearSecretCache } from "@/lib/config/secret";
import { fakeRequest } from "../../test-support/fake-request";
import { stubJmap } from "../../test-support/jmap-stub";

const originalFetch = globalThis.fetch;
const savedEnv = { ...process.env };
const cookies = mockRequestCookies();
const { composeResponse, MAX_COMPOSE_BYTES } = await import(".");

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
const server = () =>
	stubJmap({
		"Identity/get": { list: [{ id: "a", name: "Ana", email: "a@x.org" }] },
		"Mailbox/get": { list: [{ id: "Drafts", role: "drafts" }] },
		"Email/set": { created: { c: { id: "new-1" } } },
	});

describe("composeResponse", () => {
	it("saves a draft and answers a closed result, never cached", async () => {
		server();
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
		const seen = server();
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
		const seen = server();
		expect((await composeResponse(post(message))).status).toBe(401);
		expect(seen).toHaveLength(0);
	});

	it("refuses what is not JSON, is too big, does not parse or does not fit the schema", async () => {
		const seen = server();
		expect(
			(await composeResponse(post(message, { type: "text/plain" })))
				.status,
		).toBe(415);
		expect(
			(
				await composeResponse(
					post(message, { length: MAX_COMPOSE_BYTES + 1 }),
				)
			).status,
		).toBe(413);
		expect(
			(await composeResponse(post("x".repeat(MAX_COMPOSE_BYTES + 1))))
				.status,
		).toBe(413);
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
		expect(seen).toHaveLength(0);
	});

	it("requires a valid Content-Length: a chunked body or a bad number is a 411 and nothing is read", async () => {
		const seen = server();
		for (const length of [null, 0, Number.NaN, -5, 1.5]) {
			expect(
				(await composeResponse(post(message, { length }))).status,
			).toBe(411);
		}
		expect(seen).toHaveLength(0);
	});

	it("stops reading at what was declared: a body longer than its Content-Length is refused", async () => {
		const seen = server();
		const body = JSON.stringify(message);
		expect(
			(await composeResponse(post(body, { length: body.length - 5 })))
				.status,
		).toBe(413);
		expect(seen).toHaveLength(0);
	});

	it("counts bytes, not characters, and cuts a body past the cap even when it declares the cap", async () => {
		const seen = server();
		// 600 000 three-byte characters are 600 000 characters but 1 800 000 bytes.
		const wide = JSON.stringify({ ...message, text: "€".repeat(600_000) });
		expect(wide.length).toBeLessThan(MAX_COMPOSE_BYTES);
		expect(new TextEncoder().encode(wide).byteLength).toBeGreaterThan(
			MAX_COMPOSE_BYTES,
		);
		expect(
			(await composeResponse(post(wide, { length: MAX_COMPOSE_BYTES })))
				.status,
		).toBe(413);
		expect((await composeResponse(post(wide))).status).toBe(413);
		expect(seen).toHaveLength(0);
	});

	it("refuses a request with no body stream", async () => {
		server();
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
		stubJmap({});
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
