import { MailBreadcrumbs } from "@/features/mail/components/mail-breadcrumbs";
import { PlaceTrail } from "@/features/mail/components/place-trail";
import {
	messageOfSegment,
	placeOfRole,
} from "@/features/mail/links/place-params";

/** The trail of a message open in a folder the account has by role. Segments that are no role or no id name nothing. */
export default async function Trail({
	params,
	searchParams,
}: {
	params: Promise<{ role: string; id: string }>;
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
	const segments = await params;
	const place = placeOfRole(segments.role);
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
