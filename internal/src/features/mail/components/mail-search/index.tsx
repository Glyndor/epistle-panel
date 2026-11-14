import { SearchIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { NarrowSearch } from "@/features/mail/components/mail-search/narrow";
import { SearchField } from "@/features/mail/components/mail-search/search-field";
import { folderPath } from "@/features/mail/links/mail-href";
import {
	type ListFilter,
	MAX_QUERY_LENGTH,
} from "@/features/mail/schemas/mail-input";
import type { MailboxRole } from "@/features/mail/schemas/mail-view";

/**
 * The search of the mail area, in the header of the bar: one field, wide,
 * with the search icon inside its start and a placeholder that says what it
 * reads. The field is a plain GET form to the folder's own page, so it works
 * before any script has loaded and a result can be bookmarked; what narrows
 * the list beside the words is carried with it, so a new search keeps it.
 *
 * On a narrow window the field is behind an icon that opens it over the bar
 * (`mail-search/narrow`); here the field is in the bar itself.
 */
export async function MailSearch({
	box,
	role,
	q,
	filter,
}: {
	/** The folder the search reads. */
	box: string;
	/** The folder's role, when its path is the role's. */
	role: MailboxRole | null;
	/** The words the address holds, if any. */
	q: string;
	/** The filter the address holds, if any. */
	filter: ListFilter;
}) {
	const t = await getTranslations("mail");

	return (
		<NarrowSearch label={t("searchLabel")} closeLabel={t("searchClose")}>
			<search aria-label={t("searchLabel")}>
				<form
					method="get"
					action={folderPath({ box, role })}
					className="flex min-w-0 flex-1 items-center gap-2"
				>
					{filter === "all" ? null : (
						<input type="hidden" name="filter" value={filter} />
					)}
					<div className="relative min-w-0 flex-1">
						<SearchIcon
							aria-hidden="true"
							className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
						/>
						<SearchField
							name="q"
							defaultValue={q}
							maxLength={MAX_QUERY_LENGTH}
							placeholder={t("searchPlaceholder")}
							aria-label={t("searchLabel")}
							aria-keyshortcuts="/"
							className="min-w-0 flex-1 ps-9"
						/>
					</div>
					<Tooltip label={t("searchSubmit")} align="end">
						<Button type="submit" variant="outline" size="icon">
							<SearchIcon aria-hidden="true" />
							<span className="sr-only">{t("searchSubmit")}</span>
						</Button>
					</Tooltip>
				</form>
			</search>
		</NarrowSearch>
	);
}
