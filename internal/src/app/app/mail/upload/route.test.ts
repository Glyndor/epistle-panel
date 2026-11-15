import { expect, it } from "bun:test";
import { fakeRequest } from "@/features/mail/test-support/fake-request";
import { POST } from "./route";

// Audit 12: the exported POST must preserve the response's pre-body CSRF gate.
it("delegates a hostile-origin POST without touching its body", async () => {
	const request = fakeRequest({ origin: "https://evil.test" });
	let touched = 0;
	Object.defineProperty(request, "body", {
		configurable: true,
		get() {
			touched++;
			throw new Error("must not read");
		},
	});
	const response = await POST(request);
	expect(response.status).toBe(403);
	expect(await response.json()).toEqual({ ok: false, reason: "forbidden" });
	expect(touched).toBe(0);
});
