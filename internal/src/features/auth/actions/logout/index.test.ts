import { beforeEach, describe, expect, it } from "bun:test";

import { clearRevocations } from "@/lib/auth/revocation";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/session";
import {
	followRedirect,
	mockRequestCookies,
	RedirectSignal,
} from "@/lib/auth/test-support/cookies";

const cookies = mockRequestCookies();
const { logout } = await import(".");

beforeEach(() => {
	cookies.reset();
	clearRevocations();
});

describe("logout", () => {
	it("makes the token unusable, so a copy of the cookie stops working", async () => {
		const token = await cookies.signIn("ops");
		expect(await verifySession(token)).toEqual({ sub: "ops" });

		const outcome = await logout().catch((error) => error);

		expect(outcome).toBeInstanceOf(RedirectSignal);
		expect(outcome.target).toBe("/login");
		expect(await verifySession(token)).toBeNull();
	});

	it("expires the cookie with the attributes the __Host- prefix needs", async () => {
		await cookies.signIn("ops");

		await followRedirect(logout());

		expect(cookies.writes).toHaveLength(1);
		const [write] = cookies.writes;
		expect(write?.name).toBe(SESSION_COOKIE);
		expect(write?.value).toBe("");
		expect(write?.options).toMatchObject({
			maxAge: 0,
			secure: true,
			path: "/",
			httpOnly: true,
		});
		expect(write?.options).not.toHaveProperty("domain");
	});

	it("still redirects when no session was present", async () => {
		const outcome = await logout().catch((error) => error);

		expect(outcome).toBeInstanceOf(RedirectSignal);
	});
});
