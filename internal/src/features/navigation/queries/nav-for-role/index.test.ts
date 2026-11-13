import { describe, expect, it } from "bun:test";

import type { NavItem } from "@/features/navigation/schemas/nav-item";

import { navForRole } from ".";

const item = (href: NavItem["href"], roles: NavItem["roles"]): NavItem => ({
	href,
	label: "status",
	icon: "dashboard",
	group: "manage",
	roles,
});

describe("navForRole", () => {
	it("gives the admin role the admin pages in one group", () => {
		const groups = navForRole("admin");

		expect(groups).toHaveLength(1);
		expect(groups[0]?.label).toBe("manage");
		expect(groups[0]?.items.map((entry) => entry.href)).toEqual([
			"/app",
			"/app/domains",
			"/app/accounts",
			"/app/queue",
			"/app/deliveries",
			"/app/suppression",
		]);
	});

	it("gives the user role nothing from the admin list", () => {
		expect(navForRole("user")).toEqual([]);
	});

	it("keeps an entry for a role only when that role is listed on it", () => {
		const items = [
			item("/app/accounts", ["admin"]),
			item("/app/domains", ["user"]),
			item("/app/queue", ["admin", "user"]),
		];

		expect(navForRole("user", items)[0]?.items.map((e) => e.href)).toEqual([
			"/app/domains",
			"/app/queue",
		]);
		expect(navForRole("admin", items)[0]?.items.map((e) => e.href)).toEqual(
			["/app/accounts", "/app/queue"],
		);
	});

	it("does not pass the roles on to the sidebar", () => {
		const [entry] = navForRole("admin")[0]?.items ?? [];

		expect(entry).not.toHaveProperty("roles");
		expect(entry).not.toHaveProperty("group");
	});
});
