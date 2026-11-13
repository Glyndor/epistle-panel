import { describe, expect, it } from "bun:test";

import { navItemSchema } from "@/features/navigation/schemas/nav-item";
import {
	OTHER_ADMIN_ID,
	TEST_ADMIN_ID,
} from "@/lib/config/test-support/admin-id";
import { adminRoutes } from "@/lib/routes";

import { navItems } from ".";

const items = navItems(adminRoutes(TEST_ADMIN_ID));

describe("navItems", () => {
	it("holds only entries the schema accepts", () => {
		for (const item of items) {
			expect(navItemSchema.safeParse(item).success).toBe(true);
		}
	});

	it("keeps the admin pages under /app/{id}, in order, and nowhere else", () => {
		const base = `/app/${TEST_ADMIN_ID}`;
		expect(items.map((item) => String(item.href))).toEqual([
			base,
			`${base}/domains`,
			`${base}/accounts`,
			`${base}/queue`,
			`${base}/deliveries`,
			`${base}/suppression`,
		]);
	});

	it("builds its links from the id it is given", () => {
		for (const item of navItems(adminRoutes(OTHER_ADMIN_ID))) {
			expect(item.href).toContain(OTHER_ADMIN_ID);
			expect(item.href).not.toContain(TEST_ADMIN_ID);
		}
	});

	it("lists no entry twice and gives every admin entry the admin role only", () => {
		expect(new Set(items.map((item) => item.href)).size).toBe(items.length);
		for (const item of items) {
			expect(item.roles).toEqual(["admin"]);
		}
	});

	it("marks only the home entry as exact", () => {
		expect(
			items.filter((item) => item.exact).map((item) => item.label),
		).toEqual(["status"]);
	});
});
