import { SearchIcon } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip } from "@/components/ui/tooltip";
import { DensityToggle } from "@/features/mail/components/density-toggle";
import { FilterStrip } from "@/features/mail/components/filter-strip";
import type { ListDensity } from "@/features/mail/config/list-density";
import { folderPath, mailHref } from "@/features/mail/links/mail-href";
import {
	LIST_FILTERS,
	type ListFilter,
	MAX_QUERY_LENGTH,
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
 */
const FILTER =
	"inline-flex min-h-8 items-center whitespace-nowrap rounded-full bg-muted px-2.5 text-xs hover:bg-foreground/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:bg-foreground/20 pointer-coarse:min-h-11 pointer-coarse:px-3";

/** The filter in use: the accent surface and a heavier name, and its own darker steps, one further than the others'. */
const CURRENT =
	"bg-accent font-medium text-accent-foreground hover:bg-foreground/20 active:bg-foreground/25";

/**
 * Search and filters of the list. The search is a plain GET form to the
 * folder's own page, so it works before any script has loaded and a result can
 * be bookmarked; the filters are links. Both stay in the folder, which is the
 * path, and a new search or filter starts again at the first page. The search field says what the search
 * reads (the server has no text search, see `load-message-list`). The switch
 * between the comfortable and the compact list sits at the end of the search's
 * line: beside the filters it pushed them onto a second line in a narrow
 * window, and the list under them down with it.
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
			<div className="flex gap-2">
				<form
					method="get"
					action={folderPath({ box, role })}
					aria-label={t("searchLabel")}
					className="flex min-w-0 flex-1 gap-2"
				>
					{filter === "all" ? null : (
						<input type="hidden" name="filter" value={filter} />
					)}
					<Input
						type="search"
						name="q"
						defaultValue={q}
						maxLength={MAX_QUERY_LENGTH}
						aria-label={t("searchLabel")}
						aria-keyshortcuts="/"
						data-mail-search=""
						className="min-w-0 flex-1"
					/>
					<Tooltip label={t("searchSubmit")} align="end">
						<Button type="submit" variant="outline" size="icon">
							<SearchIcon aria-hidden="true" />
							<span className="sr-only">{t("searchSubmit")}</span>
						</Button>
					</Tooltip>
					{q === "" ? null : (
						<Button asChild variant="ghost" size="sm">
							<Link href={mailHref({ box, role, filter })}>
								{t("searchClear")}
							</Link>
						</Button>
					)}
				</form>
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
