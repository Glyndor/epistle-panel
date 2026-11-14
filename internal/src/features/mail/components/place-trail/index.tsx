import "server-only";

import { Suspense } from "react";

import {
	MailBreadcrumbs,
	type MailTrailPlace,
} from "@/features/mail/components/mail-breadcrumbs";
import { folderName } from "@/features/mail/components/mail-place/place-name";
import type { MailView } from "@/features/mail/links/mail-href";
import {
	type PlaceRef,
	requestMessage,
} from "@/features/mail/queries/request-mail";
import { parseListParams } from "@/features/mail/schemas/mail-input";
import { requireSession } from "@/lib/auth/require-session";

type ListParams = Pick<MailView, "page" | "filter" | "q">;

/** A folder of an address as the trail names it. */
function trailPlace(place: PlaceRef): MailTrailPlace {
	return "role" in place
		? { kind: "role", role: place.role }
		: { kind: "folder", box: place.box, name: folderName(place.box) };
}

/** The trail once the open message has answered: its subject, or nothing for one that could not be read. */
async function SubjectTrail({
	place,
	list,
	id,
}: {
	place: MailTrailPlace;
	list: ListParams;
	id: string;
}) {
	// The reader says what went wrong with a message; the trail only leaves it out.
	const message = await requestMessage(id).catch(() => undefined);

	return (
		<MailBreadcrumbs
			place={place}
			list={list}
			subject={message?.subject ?? false}
		/>
	);
}

/**
 * The trail of a folder's page, for the header of the mail area: the folder of
 * the address at once and, with a message open, its subject streamed in behind
 * a bar that holds its place. The message is the one the reader shows, read
 * once for both. The folder's link keeps what narrows its list
 * (`?page=&filter=&q=`), each parameter checked on its own.
 */
export async function PlaceTrail({
	place,
	message,
	searchParams,
}: {
	place: PlaceRef;
	/** The open message, already checked to be an id. */
	message: string | undefined;
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
	await requireSession();
	const list = parseListParams(await searchParams);
	const where = trailPlace(place);

	if (message === undefined) {
		return <MailBreadcrumbs place={where} list={list} />;
	}
	return (
		<Suspense
			key={message}
			fallback={
				<MailBreadcrumbs place={where} list={list} subject={null} />
			}
		>
			<SubjectTrail place={where} list={list} id={message} />
		</Suspense>
	);
}
