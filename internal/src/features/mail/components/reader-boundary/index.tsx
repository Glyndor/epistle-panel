import "server-only";

import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

import { MessageReader } from "@/features/mail/components/message-reader";
import { mailKeys } from "@/features/mail/queries/mail-query-keys";
import { messageQueryOptions } from "@/features/mail/queries/mail-query-options";
import { readEffectiveRemoteImagesMode } from "@/features/mail/queries/remote-images";
import {
	FALLBACK_BOX,
	type PlaceRef,
	requestMailboxes,
	requestMailSession,
	requestMessage,
	resolvePlace,
} from "@/features/mail/queries/request-mail";
import type { ListConditions } from "@/features/mail/schemas/list-conditions-model";
import { prefetch } from "@/lib/query/prefetch";
import { makeQueryClient } from "@/lib/query/query-client";

/**
 * The reader, streamed: the open message, read on the server while the folders
 * are, and both handed to the client component (it lists the folders a message
 * can move to). The caller checks the session first.
 */
export async function ReaderBoundary({
	id,
	place,
	page,
	conditions,
}: {
	id: string;
	place: PlaceRef;
	page: number;
	conditions: ListConditions;
}) {
	const client = makeQueryClient();
	const [session, remoteImagesMode] = await Promise.all([
		requestMailSession(),
		readEffectiveRemoteImagesMode(),
	]);
	const [boxes] = await Promise.all([
		requestMailboxes(),
		session === null
			? undefined
			: prefetch(
					client,
					// Read through the request's own cache: the trail of the bar
					// names the same message and must not ask for it again.
					messageQueryOptions(
						id,
						async (message) =>
							(await requestMessage(message)) ?? null,
					),
					"mail message",
				),
	]);
	if (boxes !== undefined) {
		client.setQueryData(mailKeys.mailboxes, boxes);
	}
	const resolved = await resolvePlace(place);
	// With no folder of the role asked for, the way back is the inbox.
	const view = {
		box: resolved.box ?? FALLBACK_BOX,
		role: resolved.box === null ? ("inbox" as const) : resolved.role,
		page,
		conditions,
	};

	return (
		<HydrationBoundary state={dehydrate(client)}>
			<MessageReader
				key={id}
				id={id}
				view={view}
				remoteImagesMode={remoteImagesMode}
			/>
		</HydrationBoundary>
	);
}
