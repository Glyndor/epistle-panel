import { describe, expect, it } from "bun:test";

import { accountDetailPath, isSessionPath, PUBLIC_ROUTES, ROUTES } from ".";

describe("ROUTES", () => {
	it("keeps every signed-in screen under /app, with no trailing slash", () => {
		for (const path of Object.values(ROUTES)) {
			expect(path).toMatch(/^\/app(\/[a-z-]+)?$/);
		}
	});

	it("names the screens at their literal URLs", () => {
		expect(ROUTES.home).toBe("/app");
		expect(ROUTES.domains).toBe("/app/domains");
		expect(ROUTES.accounts).toBe("/app/accounts");
		expect(ROUTES.queue).toBe("/app/queue");
		expect(ROUTES.suppression).toBe("/app/suppression");
		expect(ROUTES.deliveries).toBe("/app/deliveries");
		expect(PUBLIC_ROUTES).toEqual({ root: "/", login: "/login" });
	});

	it("builds the account page under the account list", () => {
		expect(String(accountDetailPath("alice"))).toBe("/app/accounts/alice");
	});
});

describe("isSessionPath", () => {
	it("is true for /app and everything under it", () => {
		for (const path of [
			"/app",
			"/app/",
			"/app/queue",
			"/app/accounts/alice",
			"/app/unknown/deep/path",
			...Object.values(ROUTES),
		]) {
			expect(isSessionPath(path), path).toBe(true);
		}
	});

	it("is false for the sign-in page, the root and the old unprefixed paths", () => {
		for (const path of [
			"/",
			"/login",
			"/login/",
			"/accounts",
			"/domains",
			"/queue",
			"/application",
			"/apps",
			"/x/app",
			"/robots.txt",
		]) {
			expect(isSessionPath(path), path).toBe(false);
		}
	});

	it("reads a spelling the router may read as /app as inside", () => {
		for (const path of [
			"/APP",
			"/App/queue",
			"/%61pp",
			"/%61pp/queue",
			"/%41PP/queue",
			"//app/queue",
			"///app",
			"\\app\\queue",
			"/\\app",
			"/app%2fqueue",
			"/app;x",
			"/app%",
			"/%E0%A4%A",
		]) {
			expect(isSessionPath(path), path).toBe(true);
		}
	});
});
