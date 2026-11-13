import { describe, expect, it } from "bun:test";

import { accountDetailPath, LEGACY_ROUTES, ROUTES } from ".";

describe("ROUTES", () => {
	it("keeps every signed-in screen under /app, with no trailing slash", () => {
		for (const path of Object.values(ROUTES)) {
			expect(path).toMatch(/^\/app\/[a-z-]+$/);
		}
	});

	it("names the screens at their literal URLs", () => {
		expect(ROUTES.suppression).toBe("/app/suppression");
		expect(ROUTES.deliveries).toBe("/app/deliveries");
	});

	it("builds the account page under /app and keeps the list where it still is", () => {
		expect(String(accountDetailPath("alice"))).toBe("/app/accounts/alice");
		expect(String(LEGACY_ROUTES.accounts)).toBe("/accounts");
	});
});
