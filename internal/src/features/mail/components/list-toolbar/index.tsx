import Link from "next/link";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { DensityToggle } from "@/features/mail/components/density-toggle";
import { FilterStrip } from "@/features/mail/components/filter-strip";
import type { ListDensity } from "@/features/mail/config/list-density";
import { mailHref } from "@/features/mail/links/mail-href";
import {
	LIST_FILTERS,
	type ListFilter,
	SCAN_LIMIT,
} from "@/features/mail/schemas/mail-input";
import type { MailboxRole } from "@/features/mail/schemas/mail-view";
import { cn } from "@/lib/class-names";

/** Message keys of the filter links, by filter. */
const FILTER_LABELS = {
	all: "filterAll",
	unread: "filterUnread",
	flagged: "filterFlagged",
	attachments: "filterAttachments",
} as const satisfies Record<ListFilter, string>;

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
	filter,
	q,
	density,
}: {
	box: string;
	/** The folder's role, when its path is the role's. Not named `role`, which on an element is ARIA's. */
	folderRole: MailboxRole | null;
	filter: ListFilter;
	q: string;
	/** The density the server read from the cookie and painted on the pane. */
	density: ListDensity;
}) {
	const t = useTranslations("mail");

	return (
		<div className="flex flex-col gap-2 p-2">
			<div className="flex items-center justify-end gap-2">
				{q === "" ? null : (
					<Button asChild variant="ghost" size="sm">
						<Link href={mailHref({ box, role, filter })}>
							{t("searchClear")}
						</Link>
					</Button>
				)}
				<DensityToggle density={density} />
			</div>
			{q === "" ? null : (
				<p className="text-muted-foreground text-xs">
					{t("searchNote", { count: SCAN_LIMIT })}
				</p>
			)}
			<FilterStrip label={t("filtersLabel")}>
				{LIST_FILTERS.map((value) => (
					<li key={value} className="shrink-0">
						<Link
							href={mailHref({ box, role, filter: value, q })}
							aria-current={value === filter ? "true" : undefined}
							className={cn(FILTER, value === filter && CURRENT)}
						>
							{t(FILTER_LABELS[value])}
						</Link>
					</li>
				))}
			</FilterStrip>
		</div>
	);
}
