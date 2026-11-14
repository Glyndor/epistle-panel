import { getTranslations } from "next-intl/server";

import { MailSearch } from "@/features/mail/components/mail-search";
import type { PlaceRef } from "@/features/mail/queries/request-mail";
import {
	CONDITION_LABELS,
	parseListConditions,
} from "@/features/mail/schemas/list-conditions";

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
							.map((name) => t(CONDITION_LABELS[name]))
							.join(", "),
					})}
				</p>
			)}
		</>
	);
}
