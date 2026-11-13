import "server-only";

import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

import { ListToolbar } from "@/features/mail/components/list-toolbar";
import { MessageList } from "@/features/mail/components/message-list";
import { loadMessageList } from "@/features/mail/queries/load-message-list";
import { messageListQueryOptions } from "@/features/mail/queries/mail-query-options";
import {
	requestMailSession,
	resolveBox,
} from "@/features/mail/queries/request-mail";
import type { ListFilter } from "@/features/mail/schemas/mail-input";
import { prefetch } from "@/lib/query/prefetch";
import { makeQueryClient } from "@/lib/query/query-client";

/**
 * The list pane, streamed: the search and the filters of the open folder, and
 * its page of messages, read on the server and then owned by Query in the
 * browser. A view whose address names no folder waits for the folders first,
 * to open the inbox by its role. A list that cannot be read is logged and left
 * to the client component, which asks for itself. The caller checks the
 * session first.
 */
export async function ListBoundary({
	asked,
	page,
	filter,
	q,
	selectedId,
}: {
	asked: string | undefined;
	page: number;
	filter: ListFilter;
	q: string;
	selectedId: string | undefined;
}) {
	const client = makeQueryClient();
	const session = await requestMailSession();
	const view = { box: await resolveBox(asked), page, filter, q };
	if (session !== null) {
		await prefetch(
			client,
			messageListQueryOptions(view, (input) =>
				loadMessageList(session, input),
			),
			"mail list",
		);
	}

	return (
		<HydrationBoundary state={dehydrate(client)}>
			<ListToolbar box={view.box} filter={filter} q={q} />
			<div className="relative min-h-0 flex-1 overflow-y-auto">
				<MessageList view={view} selectedId={selectedId} />
			</div>
		</HydrationBoundary>
	);
}
