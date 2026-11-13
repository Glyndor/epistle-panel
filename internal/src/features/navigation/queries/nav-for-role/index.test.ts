import { describe, expect, it } from "bun:test";
import { navItems } from "@/features/navigation/config/items";
import type { NavItem } from "@/features/navigation/schemas/nav-item";
import {
	adminNav,
	TEST_ROUTES,
} from "@/features/navigation/test-support/admin-nav";

import { navForRole } from ".";

const ITEMS = navItems(TEST_ROUTES);

const item = (href: NavItem["href"], roles: NavItem["roles"]): NavItem => ({
	href,
	label: "status",
	icon: "dashboard",
	group: "manage",
	roles,
});

describe("navForRole", () => {
	it("gives the admin role the admin pages in one group", () => {
		const groups = adminNav();

		expect(groups).toHaveLength(1);
		expect(groups[0]?.label).toBe("manage");
		expect(groups[0]?.items.map((entry) => entry.href)).toEqual([
			TEST_ROUTES.home,
			TEST_ROUTES.domains,
			TEST_ROUTES.accounts,
			TEST_ROUTES.queue,
			TEST_ROUTES.deliveries,
			TEST_ROUTES.suppression,
		]);
	});

	it("gives the user role nothing from the admin list", () => {
		expect(navForRole("user", ITEMS)).toEqual([]);
	});

	it("keeps an entry for a role only when that role is listed on it", () => {
		const items = [
			item(TEST_ROUTES.accounts, ["admin"]),
			item(TEST_ROUTES.domains, ["user"]),
			item(TEST_ROUTES.queue, ["admin", "user"]),
		];

		expect(navForRole("user", items)[0]?.items.map((e) => e.href)).toEqual([
			TEST_ROUTES.domains,
			TEST_ROUTES.queue,
		]);
		expect(navForRole("admin", items)[0]?.items.map((e) => e.href)).toEqual(
			[TEST_ROUTES.accounts, TEST_ROUTES.queue],
		);
	});

	it("does not pass the roles on to the sidebar", () => {
		const [entry] = adminNav()[0]?.items ?? [];

		expect(entry).not.toHaveProperty("roles");
		expect(entry).not.toHaveProperty("group");
	});
});
