import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { TEST_ADMIN_ID } from "@/lib/config/test-support/admin-id";
import { SESSION_COOKIE } from "../session";
import {
	mockRequestCookies,
	NotFoundSignal,
	RedirectSignal,
} from "../test-support/cookies";

const cookies = mockRequestCookies();
const { requireAdmin, requireSession } = await import(".");

beforeEach(() => cookies.reset());
afterEach(() => {
	process.env["EPISTLE_PANEL_ADMIN_ID"] = TEST_ADMIN_ID;
});

describe("requireSession", () => {
	it("returns the session of any role for a valid cookie", async () => {
		await cookies.signIn("ops", "admin");
		expect(await requireSession()).toEqual({ sub: "ops", role: "admin" });
		await cookies.signIn("ana", "user");
		expect(await requireSession()).toEqual({ sub: "ana", role: "user" });
	});

	it("redirects to the sign-in page without a cookie", async () => {
		const outcome = await requireSession().catch((error) => error);

		expect(outcome).toBeInstanceOf(RedirectSignal);
		expect(outcome.target).toBe("/");
	});

	it("redirects on a forged cookie", async () => {
		cookies.jar.set(SESSION_COOKIE, "forged.token");

		const outcome = await requireSession().catch((error) => error);

		expect(outcome).toBeInstanceOf(RedirectSignal);
	});
});

describe("requireAdmin", () => {
	it("returns the account, the id and the admin paths for an admin session", async () => {
		await cookies.signIn("ops", "admin");

		const admin = await requireAdmin();

		expect(admin.sub).toBe("ops");
		expect(admin.id).toBe(TEST_ADMIN_ID);
		expect(String(admin.routes.home)).toBe(`/app/${TEST_ADMIN_ID}`);
	});

	it("answers 404, not a redirect, to a session without the admin role", async () => {
		await cookies.signIn("ana", "user");

		expect(await requireAdmin().catch((e) => e)).toBeInstanceOf(
			NotFoundSignal,
		);
	});

	it("answers 404 without a session and with a forged one", async () => {
		expect(await requireAdmin().catch((e) => e)).toBeInstanceOf(
			NotFoundSignal,
		);
		cookies.jar.set(SESSION_COOKIE, "forged.token");
		expect(await requireAdmin().catch((e) => e)).toBeInstanceOf(
			NotFoundSignal,
		);
	});

	it("answers 404 to an admin when the installation has no admin id", async () => {
		await cookies.signIn("ops", "admin");
		delete process.env["EPISTLE_PANEL_ADMIN_ID"];

		expect(await requireAdmin().catch((e) => e)).toBeInstanceOf(
			NotFoundSignal,
		);
	});

	it("answers 404 to an admin when the configured id is malformed, never treating it as any id", async () => {
		await cookies.signIn("ops", "admin");
		process.env["EPISTLE_PANEL_ADMIN_ID"] = "not-a-uuid";

		expect(await requireAdmin().catch((e) => e)).toBeInstanceOf(
			NotFoundSignal,
		);
	});
});
