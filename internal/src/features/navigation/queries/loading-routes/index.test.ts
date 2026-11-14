import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { clearSecretCache } from "@/lib/config/secret";
import { TEST_ADMIN_ID } from "@/lib/config/test-support/admin-id";
import { loadingRoutes } from ".";

const saved = process.env["EPISTLE_PANEL_ADMIN_ID"];

beforeEach(() => clearSecretCache());
afterEach(() => {
	process.env["EPISTLE_PANEL_ADMIN_ID"] = saved;
	clearSecretCache();
});

describe("loadingRoutes", () => {
	it("is the routes of the configured admin id", async () => {
		const routes = await loadingRoutes();

		expect<string | undefined>(routes?.home).toBe(`/app/${TEST_ADMIN_ID}`);
		expect<string | undefined>(routes?.queue).toBe(
			`/app/${TEST_ADMIN_ID}/queue`,
		);
	});

	it("is nothing when the admin area is off or its id cannot be used", async () => {
		delete process.env["EPISTLE_PANEL_ADMIN_ID"];
		clearSecretCache();
		expect(await loadingRoutes()).toBeUndefined();

		for (const value of [
			"not-a-uuid",
			TEST_ADMIN_ID.toUpperCase(),
			"../../etc/passwd",
		]) {
			process.env["EPISTLE_PANEL_ADMIN_ID"] = value;
			clearSecretCache();

			expect(await loadingRoutes()).toBeUndefined();
		}
	});
});
