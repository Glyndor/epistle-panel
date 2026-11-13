import type {
	NavGroup,
	NavItem,
	Role,
} from "@/features/navigation/schemas/nav-item";

/**
 * The navigation a role sees, grouped in display order. An entry whose roles do
 * not include `role` is left out entirely, so a user-role visitor is never
 * handed an admin link. `items` comes from `navItems`, built with the installation's admin id.
 */
export function navForRole(role: Role, items: readonly NavItem[]): NavGroup[] {
	const groups = new Map<NavGroup["label"], NavGroup["items"][number][]>();
	for (const { roles, group, ...entry } of items) {
		if (!roles.includes(role)) {
			continue;
		}
		groups.set(group, [...(groups.get(group) ?? []), entry]);
	}
	return [...groups].map(([label, entries]) => ({ label, items: entries }));
}
