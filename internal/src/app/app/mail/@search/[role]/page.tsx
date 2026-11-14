import { PlaceSearch } from "@/features/mail/components/mail-search/place-search";
import { placeOfRole } from "@/features/mail/links/place-params";

/** The search of a folder the account has by role. A segment that is no role names no search. */
export default async function Search({
	params,
	searchParams,
}: {
	params: Promise<{ role: string }>;
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
	const place = placeOfRole((await params).role);
	if (place === null) {
		return null;
	}
	return <PlaceSearch place={place} searchParams={searchParams} />;
}
