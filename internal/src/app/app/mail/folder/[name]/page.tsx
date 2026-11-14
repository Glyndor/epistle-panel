import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { MailPlace } from "@/features/mail/components/mail-place";
import { placeTitle } from "@/features/mail/components/mail-place/place-title";
import { placeOfFolder } from "@/features/mail/links/place-params";

type Props = {
	params: Promise<{ name: string }>;
	searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
	const place = placeOfFolder((await params).name);
	return place === null ? {} : { title: await placeTitle(place) };
}

/** Any folder by its name, written as one segment: `/app/mail/folder/Work_2FQ4`. */
export default async function Page({ params, searchParams }: Props) {
	const segments = await params;
	const place = placeOfFolder(segments.name);
	if (place === null) {
		notFound();
	}
	return (
		<MailPlace
			place={place}
			message={undefined}
			searchParams={searchParams}
		/>
	);
}
