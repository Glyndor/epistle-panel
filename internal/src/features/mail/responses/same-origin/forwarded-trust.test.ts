import { expect, it } from "bun:test";
import { isSameOrigin } from ".";

// Audit 5: README requires the ingress to overwrite forwarded headers.
// This logic check supplements, and cannot replace, forwarded-origin.sh.
it("pins the trust boundary when a client can supply X-Forwarded-Host", () => {
	const request = (forwarded?: string) =>
		({
			headers: {
				get: (name: string) =>
					({
						origin: "https://evil.test",
						host: "panel.test",
						"x-forwarded-host": forwarded,
					})[name] ?? null,
			},
		}) as unknown as Request;
	expect(isSameOrigin(request())).toBe(false);
	expect(isSameOrigin(request("evil.test"))).toBe(true);
	expect(isSameOrigin(request("evil.test, panel.test"))).toBe(true);
	expect(isSameOrigin(request("panel.test, evil.test"))).toBe(false);
});
