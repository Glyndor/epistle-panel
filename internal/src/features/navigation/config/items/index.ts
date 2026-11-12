import type { NavItem } from "@/features/navigation/schemas/nav-item";

/**
 * Every entry of the panel's navigation, in display order. The sidebar draws
 * only what this list holds for the visitor's role, so a new surface (the
 * webmail) adds its entries here with `roles: ["user"]` and needs no change to
 * the shell. The admin routes and their URLs are the ones below.
 */
export const NAV_ITEMS: readonly NavItem[] = [
	{
		href: "/",
		label: "status",
		icon: "dashboard",
		group: "manage",
		roles: ["admin"],
	},
	{
		href: "/domains",
		label: "domains",
		icon: "globe",
		group: "manage",
		roles: ["admin"],
	},
	{
		href: "/accounts",
		label: "accounts",
		icon: "users",
		group: "manage",
		roles: ["admin"],
	},
	{
		href: "/queue",
		label: "queue",
		icon: "inbox",
		group: "manage",
		roles: ["admin"],
	},
	{
		href: "/deliveries",
		label: "deliveries",
		icon: "history",
		group: "manage",
		roles: ["admin"],
	},
	{
		href: "/suppression",
		label: "suppression",
		icon: "ban",
		group: "manage",
		roles: ["admin"],
	},
];
