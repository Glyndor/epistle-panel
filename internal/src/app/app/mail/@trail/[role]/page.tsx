import { MailBreadcrumbs } from "@/features/mail/components/mail-breadcrumbs";
import { PlaceTrail } from "@/features/mail/components/place-trail";
import { placeOfRole } from "@/features/mail/links/place-params";

/** The trail of a folder the account has by role. A segment that is no role names nothing. */
export default async function Trail({
	params,
	searchParams,
}: {
	params: Promise<{ role: string }>;
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
	const place = placeOfRole((await params).role);
	if (place === null) {
		return <MailBreadcrumbs />;
	}
	return (
		<PlaceTrail
			place={place}
			message={undefined}
			searchParams={searchParams}
		/>
	);
}
