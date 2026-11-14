import { MailBreadcrumbs } from "@/features/mail/components/mail-breadcrumbs";
import { PlaceTrail } from "@/features/mail/components/place-trail";
import {
	messageOfSegment,
	placeOfFolder,
} from "@/features/mail/links/place-params";

/** The trail of a message open in a folder named by its segment. Segments that name no folder or no id name nothing. */
export default async function Trail({
	params,
	searchParams,
}: {
	params: Promise<{ name: string; id: string }>;
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
	const segments = await params;
	const place = placeOfFolder(segments.name);
	const message = messageOfSegment(segments.id);
	if (place === null || message === null) {
		return <MailBreadcrumbs />;
	}
	return (
		<PlaceTrail
			place={place}
			message={message}
			searchParams={searchParams}
		/>
	);
}
