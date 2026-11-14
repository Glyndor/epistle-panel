import "server-only";

import { z } from "zod";

import {
	SIDEBAR_GROUPS,
	SIDEBAR_GROUPS_SEPARATOR,
	type SidebarGroupId,
} from "../groups-cookie";

/**
 * The value of the groups' cookie as a request may carry it: names of known
 * groups and nothing else, no more of them than there are groups. Anyone can
 * write a cookie, so a value that holds anything else is not read at all.
 */
const closedGroupsSchema = z
	.string()
	.transform((value) =>
		value === "" ? [] : value.split(SIDEBAR_GROUPS_SEPARATOR),
	)
	.pipe(z.array(z.enum(SIDEBAR_GROUPS)).max(SIDEBAR_GROUPS.length));

/**
 * The groups of the sidebar that start closed, from the cookie's value as the
 * request carries it. No cookie, and a value that is not a list of known
 * groups, both read as every group open.
 *
 * What it returns are the names of {@link SIDEBAR_GROUPS} themselves, picked
 * by the cookie: no character the request sent goes on to the page.
 */
export function closedSidebarGroups(
	value: string | undefined,
): readonly SidebarGroupId[] {
	const parsed = closedGroupsSchema.safeParse(value);
	if (!parsed.success) {
		return [];
	}
	return SIDEBAR_GROUPS.filter((id) => parsed.data.includes(id));
}
