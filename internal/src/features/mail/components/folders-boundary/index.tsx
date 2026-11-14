import "server-only";

import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

import { FolderPane } from "@/features/mail/components/folder-pane";
import { mailKeys } from "@/features/mail/queries/mail-query-keys";
import { requestMailboxes } from "@/features/mail/queries/request-mail";
import { makeQueryClient } from "@/lib/query/query-client";

/**
 * The folder tree, streamed: it waits for the account's folders and hands them
 * to the client component, which owns them from then on and marks the folder
 * the address shows. The mail area's layout renders it inside `Suspense`, in
 * the sidebar; the folders are read once per request, whoever else asks for
 * them. The caller checks the session first.
 */
export async function FoldersBoundary() {
	const client = makeQueryClient();
	const boxes = await requestMailboxes();
	if (boxes !== undefined) {
		client.setQueryData(mailKeys.mailboxes, boxes);
	}

	return (
		<HydrationBoundary state={dehydrate(client)}>
			<FolderPane />
		</HydrationBoundary>
	);
}
