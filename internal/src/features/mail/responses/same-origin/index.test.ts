import { describe, expect, it } from "bun:test";

import { isSameOrigin } from ".";

/** A request with exactly these headers (the test DOM drops `Host` and `Origin` from a real one, as a browser does for script). */
const request = (headers: Record<string, string>) =>
	({
		headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
	}) as unknown as Request;

describe("isSameOrigin", () => {
	it("accepts the panel's own origin, by Host or by the forwarded host", () => {
		expect(
			isSameOrigin(
				request({ origin: "https://panel.test", host: "panel.test" }),
			),
		).toBe(true);
		expect(
			isSameOrigin(
				request({
					origin: "https://mail.example.org",
					"x-forwarded-host": "mail.example.org, other",
					host: "127.0.0.1:7587",
				}),
			),
		).toBe(true);
	});

	it("refuses a missing, null, foreign or unreadable origin", () => {
		expect(isSameOrigin(request({ host: "panel.test" }))).toBe(false);
		expect(
			isSameOrigin(request({ origin: "null", host: "panel.test" })),
		).toBe(false);
		expect(
			isSameOrigin(
				request({ origin: "https://evil.test", host: "panel.test" }),
			),
		).toBe(false);
		expect(
			isSameOrigin(request({ origin: "not a url", host: "panel.test" })),
		).toBe(false);
		expect(isSameOrigin(request({ origin: "https://panel.test" }))).toBe(
			false,
		);
	});
});
