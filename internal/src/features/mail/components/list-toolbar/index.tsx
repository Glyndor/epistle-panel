import { SearchIcon } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
 * Search and filters of the list. The search is a plain GET form to the
 * folder's own page, so it works before any script has loaded and a result can
 * be bookmarked; the filters are links. Both stay in the folder, which is the
 * path, and a new search or filter starts again at the first page. The search field says what the search
 * reads (the server has no text search, see `load-message-list`).
 */
export function ListToolbar({
	box,
	folderRole: role,
	filter,
	q,
}: {
	box: string;
	/** The folder's role, when its path is the role's. Not named `role`, which on an element is ARIA's. */
	folderRole: MailboxRole | null;
	filter: ListFilter;
	q: string;
}) {
	const t = useTranslations("mail");

	return (
		<div className="flex flex-col gap-2 p-2">
			<form
				method="get"
				action={folderPath({ box, role })}
				aria-label={t("searchLabel")}
				className="flex gap-2"
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
				<Button type="submit" variant="outline" size="icon">
					<SearchIcon aria-hidden="true" />
					<span className="sr-only">{t("searchSubmit")}</span>
				</Button>
				{q === "" ? null : (
					<Button asChild variant="ghost" size="sm">
						<Link href={mailHref({ box, role, filter })}>
							{t("searchClear")}
						</Link>
					</Button>
				)}
			</form>
			{q === "" ? null : (
				<p className="text-muted-foreground text-xs">
					{t("searchNote", { count: SCAN_LIMIT })}
				</p>
			)}
			<nav aria-label={t("filtersLabel")}>
				<ul className="flex flex-wrap gap-1">
					{LIST_FILTERS.map((value) => (
						<li key={value}>
							<Link
								href={mailHref({ box, role, filter: value, q })}
								aria-current={
									value === filter ? "true" : undefined
								}
								className={cn(
									"inline-flex min-h-8 items-center rounded-full bg-muted px-3 text-xs hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring pointer-coarse:min-h-11 pointer-coarse:px-3",
									value === filter &&
										"bg-accent font-medium text-accent-foreground",
								)}
							>
								{t(FILTER_LABELS[value])}
							</Link>
						</li>
					))}
				</ul>
			</nav>
		</div>
	);
}
