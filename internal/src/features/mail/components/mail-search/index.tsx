import { getTranslations } from "next-intl/server";
import { SearchForm } from "@/features/mail/components/mail-search/form";
import { NarrowSearch } from "@/features/mail/components/mail-search/narrow";
import { folderPath } from "@/features/mail/links/mail-href";
import type { ListConditions } from "@/features/mail/schemas/list-conditions-model";
import type { MailboxRole } from "@/features/mail/schemas/mail-view";

/**
 * The search of the mail area, in the header of the bar: one field, wide,
 * with the search icon inside its start and a placeholder that says what it
 * reads. Behind a button at the end of it are the fields that narrow the
 * search further.
 *
 * The field is a plain GET form to the folder's own page, so it works before
 * any script has loaded and a result can be bookmarked; what narrows the list
 * beside the words is carried with it, so a new search keeps it.
 *
 * On a narrow window the field is behind an icon that opens it over the bar
 * (`mail-search/narrow`); here the field is in the bar itself.
 */
export async function MailSearch({
	box,
	role,
	conditions,
}: {
	/** The folder the search reads. */
	box: string;
	/** The folder's role, when its path is the role's. */
	role: MailboxRole | null;
	/** What the address holds, as the server read it. */
	conditions: ListConditions;
}) {
	const t = await getTranslations("mail");

	return (
		<NarrowSearch label={t("searchLabel")} closeLabel={t("searchClose")}>
			<SearchForm
				path={folderPath({ box, role })}
				conditions={conditions}
			/>
		</NarrowSearch>
	);
}
