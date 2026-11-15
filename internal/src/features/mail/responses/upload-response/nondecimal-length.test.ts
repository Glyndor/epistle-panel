import { afterEach, beforeEach, expect, it, mock } from "bun:test";
import { mockRequestCookies } from "@/lib/auth/test-support/cookies";
import { clearSecretCache } from "@/lib/config/secret";
import { fakeRequest } from "../../test-support/fake-request";

const cookies = mockRequestCookies();
const { uploadResponse } = await import(".");
const env = { ...process.env };
const fetchDescriptor = Object.getOwnPropertyDescriptor(globalThis, "fetch");
beforeEach(async () => {
	clearSecretCache();
	cookies.reset();
	await cookies.signIn("admin");
});
afterEach(() => {
	cookies.reset();
	process.env = { ...env };
	clearSecretCache();
	if (fetchDescriptor)
		Object.defineProperty(globalThis, "fetch", fetchDescriptor);
});
// Audit 19, REAL DEFECT: Number accepts these; null body pins acceptance without reading bytes.
it.each(["1e3", "0x64", " 100 "])(
	"currently accepts non-decimal Content-Length %s past the size gate",
	async (length) => {
		const request = fakeRequest();
		const get = request.headers.get.bind(request.headers);
		request.headers.get = (name) =>
			name.toLowerCase() === "content-length" ? length : get(name);
		let touched = 0;
		Object.defineProperty(request, "body", {
			configurable: true,
			get() {
				touched++;
				return null;
			},
		});
		const fetch = mock(async () => {
			throw new Error("must not contact JMAP");
		});
		globalThis.fetch = fetch as unknown as typeof globalThis.fetch;
		const response = await uploadResponse(request);
		expect(response.status).toBe(400); // A fixed decimal gate would answer 411 before body access.
		expect(touched).toBe(1);
		expect(fetch).not.toHaveBeenCalled();
	},
);

// Run with bun test --todo: Number currently accepts these non-decimal forms.
it.todo("#255, row 19: rejects non-decimal lengths before accessing body", async () => {
	for (const length of ["1e3", "0x64", " 100 "]) {
		const request = fakeRequest();
		const get = request.headers.get.bind(request.headers);
		request.headers.get = (name) =>
			name === "content-length" ? length : get(name);
		let touched = 0;
		Object.defineProperty(request, "body", {
			configurable: true,
			get() {
				touched++;
				return null;
			},
		});
		expect((await uploadResponse(request)).status).toBe(411);
		expect(touched).toBe(0);
	}
});
