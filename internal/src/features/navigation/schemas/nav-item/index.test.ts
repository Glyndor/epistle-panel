import { describe, expect, it } from "bun:test";

import { navItemSchema, roleSchema } from ".";

const valid = {
	href: "/domains",
	label: "domains",
	icon: "globe",
	group: "manage",
	roles: ["admin"],
};

describe("navItemSchema", () => {
	it("accepts a well-formed entry", () => {
		expect(navItemSchema.safeParse(valid).success).toBe(true);
	});

	it("rejects an entry that names no role", () => {
		expect(navItemSchema.safeParse({ ...valid, roles: [] }).success).toBe(
			false,
		);
	});

	it("rejects a href that is not an absolute in-app path", () => {
		for (const href of [
			"domains",
			"//evil.test",
			"https://evil.test",
			"/a?b=1",
			"javascript:alert(1)",
			"/A",
		]) {
			expect(navItemSchema.safeParse({ ...valid, href }).success).toBe(
				false,
			);
		}
	});

	it("rejects an unknown icon, label, group or role", () => {
		expect(navItemSchema.safeParse({ ...valid, icon: "x" }).success).toBe(
			false,
		);
		expect(navItemSchema.safeParse({ ...valid, label: "x" }).success).toBe(
			false,
		);
		expect(navItemSchema.safeParse({ ...valid, group: "x" }).success).toBe(
			false,
		);
		expect(roleSchema.safeParse("root").success).toBe(false);
	});
});
