import { beforeEach, describe, expect, it } from "bun:test";

import { mockRequestCookies, RedirectSignal } from "../test-support/cookies";

const cookies = mockRequestCookies();
const { requireSession } = await import(".");

beforeEach(() => cookies.reset());

describe("requireSession", () => {
	it("returns the session for a valid cookie", async () => {
		await cookies.signIn("ops");

		expect(await requireSession()).toEqual({ sub: "ops" });
	});

	it("redirects to the login page without a cookie", async () => {
		const outcome = await requireSession().catch((error) => error);

		expect(outcome).toBeInstanceOf(RedirectSignal);
		expect(outcome.target).toBe("/login");
	});

	it("redirects on a forged cookie", async () => {
		cookies.jar.set("__Host-epistle_admin_session", "forged.token");

		const outcome = await requireSession().catch((error) => error);

		expect(outcome).toBeInstanceOf(RedirectSignal);
	});
});
