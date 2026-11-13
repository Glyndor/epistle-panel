import type { Route } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
	OVERVIEW_PERIODS,
	type OverviewPeriod,
	overviewHref,
} from "@/features/overview/schemas/overview-input";

/**
 * The period the delivery charts cover, as links: the choice lives in the
 * address (`?since=7d`), so it works with no script, can be bookmarked and the
 * server reads it. The default period is the bare address. The current one is
 * a pill of the secondary surface, in bold, and says so to a screen reader;
 * the others have no fill until the pointer is on them. No line marks it: the
 * panel draws none. The focus ring sits two pixels off the pill, on the page's
 * own surface.
 *
 * Its words come in as props: it is drawn on the server, in the page and in
 * the loading state alike, and reads no catalog of its own.
 */
export function PeriodNav({
	period,
	home,
	label,
	names,
}: {
	period: OverviewPeriod;
	/** The overview's own path. */
	home: Route;
	/** What the navigation is, for a screen reader. */
	label: string;
	/** The words of each link. */
	names: Readonly<Record<OverviewPeriod, string>>;
}) {
	return (
		<nav aria-label={label}>
			<ul className="flex gap-1">
				{OVERVIEW_PERIODS.map((option) => (
					<li key={option}>
						<Button
							asChild
							variant={option === period ? "secondary" : "ghost"}
							className={
								option === period ? "font-semibold" : undefined
							}
						>
							<Link
								href={overviewHref(home, option)}
								aria-current={
									option === period ? "page" : undefined
								}
							>
								{names[option]}
							</Link>
						</Button>
					</li>
				))}
			</ul>
		</nav>
	);
}
