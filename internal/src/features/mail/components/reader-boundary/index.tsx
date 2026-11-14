import "server-only";

import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

import { MessageReader } from "@/features/mail/components/message-reader";
import { loadMessage } from "@/features/mail/queries/load-message";
import { mailKeys } from "@/features/mail/queries/mail-query-keys";
import { messageQueryOptions } from "@/features/mail/queries/mail-query-options";
import {
	requestMailboxes,
	requestMailSession,
	resolveBox,
} from "@/features/mail/queries/request-mail";
import type { ListFilter } from "@/features/mail/schemas/mail-input";
import { prefetch } from "@/lib/query/prefetch";
import { makeQueryClient } from "@/lib/query/query-client";

/**
 * The reader, streamed: the open message, read on the server while the folders
 * are, and both handed to the client component (it lists the folders a message
 * can move to). The caller checks the session first.
 */
export async function ReaderBoundary({
	id,
	asked,
	page,
	filter,
	q,
}: {
	id: string;
	asked: string | undefined;
	page: number;
	filter: ListFilter;
	q: string;
}) {
	const client = makeQueryClient();
	const session = await requestMailSession();
	const [boxes] = await Promise.all([
		requestMailboxes(),
		session === null
			? undefined
			: prefetch(
					client,
					messageQueryOptions(id, (message) =>
						loadMessage(session, message),
					),
					"mail message",
				),
	]);
	if (boxes !== undefined) {
		client.setQueryData(mailKeys.mailboxes, boxes);
	}
	const view = { box: await resolveBox(asked), page, filter, q };

	return (
		<HydrationBoundary state={dehydrate(client)}>
			<MessageReader key={id} id={id} view={view} />
		</HydrationBoundary>
	);
}
