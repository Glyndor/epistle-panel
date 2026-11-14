import { useTranslations } from "next-intl";

import { Trail, type TrailStep } from "@/components/layout/trail";
import {
	adminTrail,
	type Crumb,
} from "@/features/navigation/queries/admin-trail";
import type { NavLabelKey } from "@/features/navigation/schemas/nav-item";
import type { AdminRoutes } from "@/lib/routes";

/**
 * The trail of an admin page, in the bar above the content: the
 * administration, the page and, on a page about one thing, that thing. The
 * last step is the current page, marked with `aria-current` and not a link.
 * A long name is cut short there: the heading of the page shows it whole.
 *
 * `leaf` is the thing the page is about. `null` while its name is not known
 * yet: a bar holds its place and no step is the current one. `false` when the
 * address turned out to name nothing: the page before it stays a link and no
 * step is the current one, so the trail never shows as a page something that
 * is not one.
 */
export function AdminBreadcrumbs({
	routes,
	page,
	leaf,
}: {
	routes: AdminRoutes;
	page: NavLabelKey;
	leaf?: string | null | false;
}) {
	const t = useTranslations("nav");
	const trail = adminTrail(routes, page, leaf === false ? undefined : leaf);
	const steps = trail.map((crumb: Crumb, index): TrailStep => {
		if (crumb.kind === "leaf") {
			// An account's name is plain ASCII by the rule every address of the
			// administration is read with, so it needs no isolation.
			return {
				key: crumb.kind,
				text: crumb.text,
				current: crumb.text !== null,
			};
		}
		return {
			key: crumb.kind,
			text: crumb.kind === "area" ? t("administration") : t(crumb.label),
			href: crumb.href,
			current: leaf !== false && index === trail.length - 1,
		};
	});

	return <Trail label={t("breadcrumb")} steps={steps} />;
}
