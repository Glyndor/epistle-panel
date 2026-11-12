import { describe, expect, it } from "bun:test";

import { navItemSchema } from "@/features/navigation/schemas/nav-item";

import { NAV_ITEMS } from ".";

describe("NAV_ITEMS", () => {
	it("holds only entries the schema accepts", () => {
		for (const item of NAV_ITEMS) {
			expect(navItemSchema.safeParse(item).success).toBe(true);
		}
	});

	it("keeps the admin pages at their URLs, in order", () => {
		expect(NAV_ITEMS.map((item) => item.href)).toEqual([
			"/",
			"/domains",
			"/accounts",
			"/queue",
			"/suppression",
		]);
	});

	it("lists no entry twice and gives every admin entry the admin role only", () => {
		expect(new Set(NAV_ITEMS.map((item) => item.href)).size).toBe(
			NAV_ITEMS.length,
		);
		for (const item of NAV_ITEMS) {
			expect(item.roles).toEqual(["admin"]);
		}
	});
});
