import { PlaceTrail } from "@/features/mail/components/place-trail";

const INBOX = { role: "inbox" } as const;

/** The trail of the mail area's home, which is the inbox. */
export default function Trail({
	searchParams,
}: {
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
	return (
		<PlaceTrail
			place={INBOX}
			message={undefined}
			searchParams={searchParams}
		/>
	);
}
