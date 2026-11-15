import { afterEach, beforeEach, expect, it } from "bun:test";
import { mockRequestCookies } from "@/lib/auth/test-support/cookies";
import { clearSecretCache } from "@/lib/config/secret";
import { fakeRequest } from "../../test-support/fake-request";
import { stubJmap } from "../../test-support/jmap-stub";

const cookies = mockRequestCookies();
const { composeResponse } = await import(".");
const env = { ...process.env };
const fetchDescriptor = Object.getOwnPropertyDescriptor(globalThis, "fetch");
beforeEach(async () => {
	clearSecretCache();
	cookies.reset();
	process.env["EPISTLE_API_URL"] = "http://127.0.0.1:8025";
	process.env["EPISTLE_API_TOKEN"] = "t";
	await cookies.signIn("admin");
});
afterEach(() => {
	cookies.reset();
	process.env = { ...env };
	clearSecretCache();
	if (fetchDescriptor)
		Object.defineProperty(globalThis, "fetch", fetchDescriptor);
});

// fakeRequest preserves the raw value: real Headers would trim whitespace.
function rawLength(length: string | null) {
	const request = fakeRequest({ type: "application/json", body: "{}" });
	const get = request.headers.get.bind(request.headers);
	request.headers.get = (name) =>
		name.toLowerCase() === "content-length" ? length : get(name);
	let touched = 0;
	const body = request.body;
	Object.defineProperty(request, "body", {
		get() {
			touched++;
			return body;
		},
	});
	return { request, touches: () => touched };
}
it("compose: rejects nondecimal Content-Length before body access", async () => {
	const seen = stubJmap({});
	for (const length of [
		"1e3",
		"0x64",
		"0b10",
		"0o10",
		" 100 ",
		"100 ",
		" 100",
		"+100",
		"1.0",
		"1_000",
		"1\n",
		"1\r\n",
		"١",
		"１２",
	]) {
		const { request, touches } = rawLength(length);
		const response = await composeResponse(request);
		expect([length, response.status, touches()]).toEqual([length, 411, 0]);
		expect(await response.json()).toEqual({ ok: false, reason: "invalid" });
	}
	expect(seen).toHaveLength(0);
});
it("rejects missing empty zero negative and sixteen-digit lengths before body access", async () => {
	const seen = stubJmap({});
	for (const length of [
		null,
		"",
		"0",
		"000",
		"-1",
		"0000000000000001",
		"9999999999999999",
	]) {
		const { request, touches } = rawLength(length);
		const response = await composeResponse(request);
		expect([length, response.status, touches()]).toEqual([length, 411, 0]);
	}
	expect(seen).toHaveLength(0);
});
it("accepts fifteen decimal digits as a size then applies the cap before body access", async () => {
	const seen = stubJmap({});
	const { request, touches } = rawLength("999999999999999");
	expect((await composeResponse(request)).status).toBe(413);
	expect(touches()).toBe(0);
	expect(seen.every((r) => r.calls.length === 0)).toBe(true);
});
it("accepts a zero-padded decimal Content-Length and saves the draft", async () => {
	stubJmap({
		"Identity/get": { list: [{ id: "a", email: "a@example.org" }] },
		"Mailbox/get": { list: [{ id: "Drafts", role: "drafts" }] },
		"Email/set": { created: { c: { id: "new-1" } } },
	});
	const body = JSON.stringify({
		op: "draft",
		to: [],
		cc: [],
		bcc: [],
		subject: "s",
		text: "t",
		attachments: [],
	});
	const request = fakeRequest({ type: "application/json", body });
	const get = request.headers.get.bind(request.headers);
	request.headers.get = (name) =>
		name === "content-length"
			? String(new TextEncoder().encode(body).byteLength).padStart(
					15,
					"0",
				)
			: get(name);
	const response = await composeResponse(request);
	expect(response.status).toBe(200);
	expect(await response.json()).toEqual({
		ok: true,
		result: { kind: "draft", id: "new-1" },
	});
});
