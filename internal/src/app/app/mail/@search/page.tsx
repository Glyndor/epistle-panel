import { PlaceSearch } from "@/features/mail/components/mail-search/place-search";

const INBOX = { role: "inbox" } as const;

/** The search of the mail area's home, which is the inbox. */
export default function Search({
	searchParams,
}: {
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
	return <PlaceSearch place={INBOX} searchParams={searchParams} />;
}
