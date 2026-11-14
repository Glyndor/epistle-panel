import { PlaceSearch } from "@/features/mail/components/mail-search/place-search";
import {
	messageOfSegment,
	placeOfFolder,
} from "@/features/mail/links/place-params";

/** The search of a folder named by its segment, with a message open in it. The message is still that folder. */
export default async function Search({
	params,
	searchParams,
}: {
	params: Promise<{ name: string; id: string }>;
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
	const segments = await params;
	const place = placeOfFolder(segments.name);
	if (place === null || messageOfSegment(segments.id) === null) {
		return null;
	}
	return <PlaceSearch place={place} searchParams={searchParams} />;
}
