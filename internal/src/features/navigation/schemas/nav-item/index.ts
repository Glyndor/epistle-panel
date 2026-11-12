import { z } from "zod";

/**
 * Who a navigation entry is for. `admin` is the administration panel; `user`
 * is the end-user webmail, which the panel will host under `/m`. A user session
 * never reaches an admin entry: the role decides what is listed, and the
 * routes still check the session themselves.
 */
export const roleSchema = z.enum(["admin", "user"]);
export type Role = z.infer<typeof roleSchema>;

/** Names of the icons a navigation entry can ask for, resolved by the sidebar. */
export const NAV_ICON_NAMES = ["dashboard", "globe", "users", "inbox"] as const;
export const navIconSchema = z.enum(NAV_ICON_NAMES);
export type NavIconName = z.infer<typeof navIconSchema>;

/** Keys of the `nav` message namespace that label an entry. */
export const navLabelKeySchema = z.enum([
	"status",
	"domains",
	"accounts",
	"queue",
]);
export type NavLabelKey = z.infer<typeof navLabelKeySchema>;

/** Keys of the `nav` message namespace that label a group of entries. */
export const navGroupKeySchema = z.enum(["manage"]);
export type NavGroupKey = z.infer<typeof navGroupKeySchema>;

/** One entry of the navigation: where it goes, how it looks, who sees it. */
export const navItemSchema = z.object({
	href: z.string().regex(/^\/[a-z0-9/_-]*$/),
	label: navLabelKeySchema,
	icon: navIconSchema,
	group: navGroupKeySchema,
	roles: z.array(roleSchema).min(1),
});
export type NavItem = z.infer<typeof navItemSchema>;

/** A labelled run of entries, as the sidebar draws it. */
export interface NavGroup {
	label: NavGroupKey;
	items: ReadonlyArray<Omit<NavItem, "roles" | "group">>;
}
