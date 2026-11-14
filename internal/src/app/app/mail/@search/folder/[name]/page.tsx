import { PlaceSearch } from "@/features/mail/components/mail-search/place-search";
import { placeOfFolder } from "@/features/mail/links/place-params";

/** The search of a folder named by its segment. A segment that names no folder names no search. */
export default async function Search({
	params,
	searchParams,
}: {
	params: Promise<{ name: string }>;
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
	const place = placeOfFolder((await params).name);
	if (place === null) {
		return null;
	}
	return <PlaceSearch place={place} searchParams={searchParams} />;
}
