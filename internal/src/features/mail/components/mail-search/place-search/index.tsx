import { getTranslations } from "next-intl/server";

import { MailSearch } from "@/features/mail/components/mail-search";
import type { PlaceRef } from "@/features/mail/queries/request-mail";
import {
	type ConditionName,
	parseListConditions,
} from "@/features/mail/schemas/list-conditions";

/** The name of the field each condition is set in, to name it when it is refused. */
const CONDITION_NAMES = {
	q: "searchWords",
	from: "from",
	to: "to",
	subject: "fieldSubject",
	after: "conditionAfter",
	before: "conditionBefore",
	label: "conditionLabel",
	folder: "conditionFolder",
	unread: "filterUnread",
	starred: "filterFlagged",
	important: "filterImportant",
	attachment: "hasAttachment",
	order: "conditionOrder",
} as const satisfies Record<ConditionName, string>;

/**
 * The search of a place of the mail area, in the header of the bar: the
 * folder's own path, with the conditions the address holds. A place that
 * names no folder names no search either.
 *
 * A condition the server did not apply is named under the field: the value
 * was too long or was not valid, and it was not shortened to make it fit.
 */
export async function PlaceSearch({
	place,
	searchParams,
}: {
	/** The place the page shows, already checked. */
	place: PlaceRef;
	/** What the address holds, checked on the server. */
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
	const t = await getTranslations("mail");
	const { conditions, rejected } = parseListConditions(await searchParams);

	return (
		<>
			<MailSearch
				box={"box" in place ? place.box : ""}
				role={"role" in place ? place.role : null}
				conditions={conditions}
			/>
			{rejected.length === 0 ? null : (
				<p role="alert" className="text-destructive px-2 text-xs">
					{t("conditionRejected", {
						name: rejected
							.map((name) =>
								t(CONDITION_NAMES[name] ?? "searchWords"),
							)
							.join(", "),
					})}
				</p>
			)}
		</>
	);
}
