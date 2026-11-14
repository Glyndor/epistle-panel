import Link from "next/link";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { DensityToggle } from "@/features/mail/components/density-toggle";
import { FilterStrip } from "@/features/mail/components/filter-strip";
import type { ListDensity } from "@/features/mail/config/list-density";
import { mailHref } from "@/features/mail/links/mail-href";
import {
	hasConditions,
	type ListConditions,
	QUICK_FILTERS,
	type QuickFilter,
} from "@/features/mail/schemas/list-conditions-model";
import { SCAN_LIMIT } from "@/features/mail/schemas/mail-input";
import type { MailboxRole } from "@/features/mail/schemas/mail-view";
import { cn } from "@/lib/class-names";

/** The filters of the pane, each one alone: the quick filter it names and no other. */
const FILTERS = [
	{ key: "filterAll", filter: null },
	{ key: "filterUnread", filter: "unread" },
	{ key: "filterFlagged", filter: "starred" },
	{ key: "filterAttachments", filter: "attachment" },
] as const satisfies readonly {
	key: string;
	filter: QuickFilter | null;
}[];

/**
 * The conditions with one quick filter on and the others off: what a filter
 * of the pane is, while the filters are one at a time.
 */
function withFilter(
	conditions: ListConditions,
	filter: QuickFilter | null,
): ListConditions {
	return {
		...conditions,
		unread: filter === "unread",
		starred: filter === "starred",
		important: filter === "important",
		attachment: filter === "attachment",
	};
}

/**
 * A filter: a pill on the pane, darker under the pointer and darker again
 * under a press. Its side padding is 10 px on a fine pointer and not 12: with
 * 12 the four did not fit a 360 px window in Italian and Portuguese (334 and
 * 330 px in 328), and the last was cut at rest.
 *
 * A filter is chrome, like every link that is a control: its name is not
 * selectable (`select-none`). See
 * `docs/maintainers/cursor-and-selection.md`.
 */
const FILTER =
	"inline-flex min-h-8 items-center whitespace-nowrap rounded-full bg-muted px-2.5 text-xs select-none hover:bg-foreground/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:bg-foreground/20 pointer-coarse:min-h-11 pointer-coarse:px-3";

/** The filter in use: the accent surface and a heavier name, and its own darker steps, one further than the others'. */
const CURRENT =
	"bg-accent font-medium text-accent-foreground hover:bg-foreground/20 active:bg-foreground/25";

/**
 * What the list is narrowed by, over the results: the filters of the folder
 * and the note that says what the search reads. The search itself is in the
 * header of the bar (`mail-search`), where there is room for it; the filters
 * are here, beside the list they narrow.
 */
export function ListToolbar({
	box,
	folderRole: role,
	conditions,
	density,
}: {
	box: string;
	/** The folder's role, when its path is the role's. Not named `role`, which on an element is ARIA's. */
	folderRole: MailboxRole | null;
	/** What narrows the list, as the address said it. */
	conditions: ListConditions;
	/** The density the server read from the cookie and painted on the pane. */
	density: ListDensity;
}) {
	const t = useTranslations("mail");
	const active = QUICK_FILTERS.filter((name) => conditions[name]);

	return (
		<div className="flex flex-col gap-2 p-2">
			<div className="flex items-center justify-end gap-2">
				{conditions.q === "" ? null : (
					<Button asChild variant="ghost" size="sm">
						<Link
							href={mailHref({
								box,
								role,
								conditions: { ...conditions, q: "" },
							})}
						>
							{t("searchClear")}
						</Link>
					</Button>
				)}
				<DensityToggle density={density} />
			</div>
			{hasConditions(conditions) ? (
				<p className="text-muted-foreground text-xs">
					{t("searchNote", { count: SCAN_LIMIT })}
				</p>
			) : null}
			<FilterStrip label={t("filtersLabel")}>
				{FILTERS.map(({ key, filter }) => {
					const current =
						filter === null
							? active.length === 0
							: active.length === 1 && active[0] === filter;
					return (
						<li key={key} className="shrink-0">
							<Link
								href={mailHref({
									box,
									role,
									conditions: withFilter(conditions, filter),
								})}
								aria-current={current ? "true" : undefined}
								className={cn(FILTER, current && CURRENT)}
							>
								{t(key)}
							</Link>
						</li>
					);
				})}
			</FilterStrip>
		</div>
	);
}
