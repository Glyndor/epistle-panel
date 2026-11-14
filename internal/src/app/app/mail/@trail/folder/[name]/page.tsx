import { MailBreadcrumbs } from "@/features/mail/components/mail-breadcrumbs";
import { PlaceTrail } from "@/features/mail/components/place-trail";
import { placeOfFolder } from "@/features/mail/links/place-params";

/** The trail of a folder named by its segment. A segment that names no folder names nothing. */
export default async function Trail({
	params,
	searchParams,
}: {
	params: Promise<{ name: string }>;
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
	const place = placeOfFolder((await params).name);
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
