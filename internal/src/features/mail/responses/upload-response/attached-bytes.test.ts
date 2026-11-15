import { afterEach, beforeEach, expect, it } from "bun:test";
import { mockRequestCookies } from "@/lib/auth/test-support/cookies";
import { clearSecretCache } from "@/lib/config/secret";
import { fakeRequest } from "../../test-support/fake-request";
import { sessionResource, stubJmap } from "../../test-support/jmap-stub";

const cookies = mockRequestCookies();
const { uploadResponse } = await import(".");
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

function upload(attached: string | null) {
	const url = new URL("https://panel.test/app/mail/upload");
	if (attached !== null) url.searchParams.set("attachedBytes", attached);
	const request = fakeRequest({
		url: url.href,
		body: "x",
		type: "text/plain",
	});
	const body = request.body;
	let touched = 0;
	Object.defineProperty(request, "body", {
		get() {
			touched++;
			return body;
		},
	});
	return { request, touches: () => touched };
}
it("rejects nondecimal attachedBytes before reading the upload", async () => {
	const seen = stubJmap({});
	for (const attached of [
		"1e3",
		"0x64",
		"0b10",
		"0o10",
		" 100 ",
		"+1",
		"1.0",
		"-1",
		"",
		"1_000",
		"1\n",
		"١",
		"１２",
	]) {
		const { request, touches } = upload(attached);
		const response = await uploadResponse(request);
		expect([attached, response.status, touches()]).toEqual([
			attached,
			400,
			0,
		]);
		expect(await response.json()).toEqual({ ok: false, reason: "invalid" });
	}
	expect(seen.every((r) => r.url.endsWith("/jmap/session"))).toBe(true);
});
it("rejects sixteen-digit attachedBytes even when its numeric value is small", async () => {
	const seen = stubJmap({});
	for (const attached of ["0000000000000001", "9999999999999999"]) {
		const { request, touches } = upload(attached);
		expect((await uploadResponse(request)).status).toBe(400);
		expect(touches()).toBe(0);
	}
	expect(seen.every((r) => r.url.endsWith("/jmap/session"))).toBe(true);
});
it("counts fifteen-digit attachedBytes against the total before reading the upload", async () => {
	const seen = stubJmap(
		{},
		undefined,
		sessionResource({ maxSizeAttachmentsPerEmail: 5 }),
	);
	const { request, touches } = upload("000000000000005");
	const response = await uploadResponse(request);
	expect(response.status).toBe(413);
	expect(await response.json()).toEqual({
		ok: false,
		reason: "tooLargeAttachments",
		limit: 5,
	});
	expect(touches()).toBe(0);
	expect(seen.every((r) => r.url.endsWith("/jmap/session"))).toBe(true);
});
it("accepts missing zero and padded attachedBytes at the exact total budget", async () => {
	for (const attached of [null, "0", "000000000000000", "000000000000004"]) {
		stubJmap(
			{},
			undefined,
			sessionResource({ maxSizeAttachmentsPerEmail: 5 }),
		);
		const fetchSession = globalThis.fetch;
		const uploaded: string[] = [];
		globalThis.fetch = (async (url, init) => {
			if (String(url).endsWith("/jmap/session"))
				return fetchSession(url, init);
			uploaded.push(String(url));
			if (!init) throw new Error("upload requires a request body");
			const reader = (
				init.body as ReadableStream<Uint8Array>
			).getReader();
			expect((await reader.read()).value).toEqual(
				new TextEncoder().encode("x"),
			);
			expect((await reader.read()).done).toBe(true);
			reader.releaseLock();
			return new Response(JSON.stringify({ blobId: "b", size: 1 }));
		}) as typeof fetch;
		const { request, touches } = upload(attached);
		// The length gate also accepts fifteen-digit, zero-padded positive values.
		const get = request.headers.get.bind(request.headers);
		request.headers.get = (name) =>
			name === "content-length" ? "000000000000001" : get(name);
		const response = await uploadResponse(request);
		expect([attached, response.status]).toEqual([attached, 200]);
		expect(await response.json()).toMatchObject({
			ok: true,
			attachment: { blobId: "b", size: 1 },
		});
		expect(uploaded).toEqual(["http://127.0.0.1:8025/jmap/upload/admin"]);
		expect(touches()).toBe(2);
	}
});
