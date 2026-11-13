import type { Route } from "next";

import type { NavLabelKey } from "@/features/navigation/schemas/nav-item";
import type { AdminRoutes } from "@/lib/routes";

/** A step of the trail: a label of the `nav` messages, or a name shown as it is. */
export type Crumb =
	/** The administration itself, the first step of every trail. */
	| { kind: "area"; href: Route }
	/** A page of the administration, named like its navigation entry. */
	| { kind: "page"; label: NavLabelKey; href: Route }
	/** Something the page is about, such as an account; `null` while its name is not known. */
	| { kind: "leaf"; text: string | null };

/** The address of each page of the administration, by the key of its navigation label. */
function pageHref(routes: AdminRoutes, page: NavLabelKey): Route {
	return page === "status" ? routes.home : routes[page];
}

/**
 * The trail to a page of the administration: the area, the page and, for a
 * page about one thing, that thing. Every address comes from the admin routes,
 * so the trail cannot name a path the panel does not have. The last step is
 * where the person is; the component draws it as the current page, not a link.
 *
 * `leaf` is the name of the thing (an account), or `null` when the page is
 * still starting and does not know it yet.
 */
export function adminTrail(
	routes: AdminRoutes,
	page: NavLabelKey,
	leaf?: string | null,
): readonly Crumb[] {
	const trail: Crumb[] = [
		{ kind: "area", href: routes.home },
		{ kind: "page", label: page, href: pageHref(routes, page) },
	];
	if (leaf !== undefined) {
		trail.push({ kind: "leaf", text: leaf });
	}
	return trail;
}
