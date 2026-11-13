import Link from "next/link";
import { useTranslations } from "next-intl";
import { Fragment } from "react";

import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Skeleton } from "@/components/ui/skeleton";
import {
	adminTrail,
	type Crumb,
} from "@/features/navigation/queries/admin-trail";
import type { NavLabelKey } from "@/features/navigation/schemas/nav-item";
import type { AdminRoutes } from "@/lib/routes";

/**
 * The trail above the heading of an admin page: the administration, the page
 * and, on a page about one thing, that thing. A page and its `loading.tsx`
 * render the same call, so the trail does not move when the page arrives. The
 * last step is the current page, marked with `aria-current` and not a link;
 * while its name is not known yet a bar holds its place. A long name is cut
 * short there: the heading below shows it whole.
 *
 * Without routes (the admin area is off) it draws nothing.
 */
export function AdminBreadcrumbs({
	routes,
	page,
	leaf,
}: {
	routes: AdminRoutes | undefined;
	page: NavLabelKey;
	/** The thing the page is about; `null` while the page does not know its name yet. */
	leaf?: string | null;
}) {
	const t = useTranslations("nav");
	if (routes === undefined) {
		return null;
	}
	const trail = adminTrail(routes, page, leaf);
	const text = (crumb: Crumb) =>
		crumb.kind === "area"
			? t("administration")
			: crumb.kind === "page"
				? t(crumb.label)
				: crumb.text;

	return (
		<Breadcrumb aria-label={t("breadcrumb")}>
			{/* A step has 4px of padding for its hover fill; pulled back by
			    as much, its text starts where the heading below starts.
			    The trail stays on one line whatever the name at its end:
			    that step gives way and is cut short, so the trail is as
			    tall with a name, with a long one and with the bar that
			    holds its place, and the heading below does not move. */}
			<BreadcrumbList className="-ms-1 flex-nowrap">
				{trail.map((crumb, index) => {
					const last = index === trail.length - 1;
					return (
						<Fragment key={crumb.kind}>
							{index > 0 ? (
								<BreadcrumbSeparator className="shrink-0" />
							) : null}
							<BreadcrumbItem
								className={
									crumb.kind === "leaf"
										? "min-w-0"
										: "shrink-0"
								}
							>
								{crumb.kind === "leaf" &&
								crumb.text === null ? (
									<Skeleton className="h-4 w-24 max-w-full rounded-md" />
								) : last || crumb.kind === "leaf" ? (
									<BreadcrumbPage className="min-w-0 truncate">
										{text(crumb)}
									</BreadcrumbPage>
								) : (
									<BreadcrumbLink asChild>
										<Link href={crumb.href}>
											{text(crumb)}
										</Link>
									</BreadcrumbLink>
								)}
							</BreadcrumbItem>
						</Fragment>
					);
				})}
			</BreadcrumbList>
		</Breadcrumb>
	);
}
