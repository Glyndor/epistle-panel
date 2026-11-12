import { describe, expect, it } from "bun:test";

import { ROUTES } from ".";

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
});
