import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { MailPlace } from "@/features/mail/components/mail-place";
import { placeTitle } from "@/features/mail/components/mail-place/place-title";
import {
	messageOfSegment,
	placeOfRole,
} from "@/features/mail/links/place-params";

type Props = {
	params: Promise<{ role: string; id: string }>;
	searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
	const place = placeOfRole((await params).role);
	return place === null ? {} : { title: await placeTitle(place) };
}

/** A message open in a folder the account has by role: `/app/mail/inbox/<id>`. */
export default async function Page({ params, searchParams }: Props) {
	const segments = await params;
	const place = placeOfRole(segments.role);
	const message = messageOfSegment(segments.id);
	if (place === null || message === null) {
		notFound();
	}
	return (
		<MailPlace
			place={place}
			message={message}
			searchParams={searchParams}
		/>
	);
}
