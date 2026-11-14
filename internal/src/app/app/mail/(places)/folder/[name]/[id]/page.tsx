import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { MailPlace } from "@/features/mail/components/mail-place";
import { placeTitle } from "@/features/mail/components/mail-place/place-title";
import {
	messageOfSegment,
	placeOfFolder,
} from "@/features/mail/links/place-params";

type Props = {
	params: Promise<{ name: string; id: string }>;
	searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
	const place = placeOfFolder((await params).name);
	return place === null ? {} : { title: await placeTitle(place) };
}

/** A message open in a folder named by its segment: `/app/mail/folder/<name>/<id>`. */
export default async function Page({ params, searchParams }: Props) {
	const segments = await params;
	const place = placeOfFolder(segments.name);
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
