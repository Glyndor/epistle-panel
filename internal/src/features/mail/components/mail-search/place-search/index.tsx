import { MailSearch } from "@/features/mail/components/mail-search";
import type { PlaceRef } from "@/features/mail/queries/request-mail";
import { parseListParams } from "@/features/mail/schemas/mail-input";

/**
 * The search of a place of the mail area, in the header of the bar: the
 * folder's own path, with the words and the filter the address holds. A place
 * that names no folder names no search either.
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
	const params = parseListParams(await searchParams);

	return (
		<MailSearch
			box={"box" in place ? place.box : ""}
			role={"role" in place ? place.role : null}
			q={params.q}
			filter={params.filter}
		/>
	);
}
