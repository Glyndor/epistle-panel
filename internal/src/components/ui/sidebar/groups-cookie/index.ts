/**
 * The cookie that keeps which groups of the sidebar's navigation are closed,
 * for both areas of the panel. A layout reads it on the server, so the first
 * paint and the loading state already have each group as the person left it;
 * the sidebar's provider writes it in the browser.
 *
 * Like the sidebar's own cookie (`../cookie`), this module has no
 * `"use client"`: the layouts read the cookie by the name exported here, and
 * a value exported from a client module is a reference on the server. It has
 * no schema either, so the provider can import it; the reading of the cookie,
 * which parses what the request sent, is `../closed-groups`.
 */

/**
 * Every group of the navigation that can be closed, in both areas. The cookie
 * holds names from this list and nothing else: a name that is not here is not
 * a group.
 */
export const SIDEBAR_GROUPS = [
	"manage",
	"folders",
	"labels",
	"calendar",
] as const;

/** The name of a group that can be closed. */
export type SidebarGroupId = (typeof SIDEBAR_GROUPS)[number];

/** Name of the cookie. */
export const SIDEBAR_GROUPS_COOKIE = "sidebar_groups";

/** What stands between two names in the cookie's value. A comma is not allowed in one. */
export const SIDEBAR_GROUPS_SEPARATOR = ".";

/** A year, in seconds. */
const SIDEBAR_GROUPS_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * The cookie as the browser stores it: the closed groups, in the order of
 * {@link SIDEBAR_GROUPS}, each once. With no group closed the cookie is taken
 * away, since no cookie already reads as every group open. Its path is the
 * whole panel, so a group closed in the mail area stays closed while the
 * administration writes its own.
 */
export function sidebarGroupsCookie(closed: readonly SidebarGroupId[]): string {
	const value = SIDEBAR_GROUPS.filter((id) => closed.includes(id)).join(
		SIDEBAR_GROUPS_SEPARATOR,
	);
	const maxAge = value === "" ? 0 : SIDEBAR_GROUPS_MAX_AGE;
	return `${SIDEBAR_GROUPS_COOKIE}=${value}; path=/; max-age=${maxAge}; SameSite=Lax`;
}
