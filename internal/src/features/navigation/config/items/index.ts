import type { NavItem } from "@/features/navigation/schemas/nav-item";
import type { AdminRoutes } from "@/lib/routes";

/**
 * Every entry of the panel's navigation, in display order. The sidebar draws
 * only what this list holds for the visitor's role, so a new surface (the
 * webmail) adds its entries here with `roles: ["user"]` and needs no change to
 * the shell. The admin routes and their URLs are the ones below, built from the
 * installation's admin id.
 */
export function navItems(routes: AdminRoutes): readonly NavItem[] {
	return [
		{
			href: routes.home,
			exact: true,
			label: "status",
			icon: "dashboard",
			group: "manage",
			roles: ["admin"],
		},
		{
			href: routes.domains,
			label: "domains",
			icon: "globe",
			group: "manage",
			roles: ["admin"],
		},
		{
			href: routes.accounts,
			label: "accounts",
			icon: "users",
			group: "manage",
			roles: ["admin"],
		},
		{
			href: routes.queue,
			label: "queue",
			icon: "inbox",
			group: "manage",
			roles: ["admin"],
		},
		{
			href: routes.deliveries,
			label: "deliveries",
			icon: "history",
			group: "manage",
			roles: ["admin"],
		},
		{
			href: routes.suppression,
			label: "suppression",
			icon: "ban",
			group: "manage",
			roles: ["admin"],
		},
	];
}
