import type { Metadata } from "next";

import { MailPlace } from "@/features/mail/components/mail-place";
import { placeTitle } from "@/features/mail/components/mail-place/place-title";

const INBOX = { role: "inbox" } as const;

export async function generateMetadata(): Promise<Metadata> {
	return { title: await placeTitle(INBOX) };
}

/**
 * The mail area's home is the inbox, the same page as `/app/mail/inbox`, so
 * signing in lands on it with no second trip. An address from before a folder
 * was a path (`?box=` or `?msg=`) never gets here: the proxy sends it on to
 * the page it meant (`legacyMailTarget`), since a redirect from under a
 * loading state would answer 200.
 */
export default async function MailHome({
	searchParams,
}: {
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
	return (
		<MailPlace
			place={INBOX}
			message={undefined}
			searchParams={searchParams}
		/>
	);
}
