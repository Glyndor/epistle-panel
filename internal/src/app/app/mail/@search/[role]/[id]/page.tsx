import { PlaceSearch } from "@/features/mail/components/mail-search/place-search";
import {
	messageOfSegment,
	placeOfRole,
} from "@/features/mail/links/place-params";

/** The search of a folder the account has by role, with a message open in it. The message is still that folder. */
export default async function Search({
	params,
	searchParams,
}: {
	params: Promise<{ role: string; id: string }>;
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
	const segments = await params;
	const place = placeOfRole(segments.role);
	if (place === null || messageOfSegment(segments.id) === null) {
		return null;
	}
	return <PlaceSearch place={place} searchParams={searchParams} />;
}
