import { describe, expect, it } from "bun:test";

import { PREFERENCE_COOKIE_MAX_AGE_SECONDS, preferenceCookieOptions } from ".";

describe("preferenceCookieOptions", () => {
	it("lives a year and is sent over HTTPS only, to the same site only", () => {
		expect(PREFERENCE_COOKIE_MAX_AGE_SECONDS).toBe(31_536_000);
		expect(preferenceCookieOptions({ httpOnly: true, path: "/" })).toEqual({
			httpOnly: true,
			secure: true,
			sameSite: "lax",
			path: "/",
			maxAge: 31_536_000,
		});
	});

	it("takes whether a script may read it and where it is sent from the caller", () => {
		expect(
			preferenceCookieOptions({ httpOnly: false, path: "/app" }),
		).toMatchObject({ httpOnly: false, path: "/app" });
	});
});
