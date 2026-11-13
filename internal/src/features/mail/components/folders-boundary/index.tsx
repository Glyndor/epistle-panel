import "server-only";

import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

import { FolderPane } from "@/features/mail/components/folder-pane";
import { mailKeys } from "@/features/mail/queries/mail-query-keys";
import {
	requestMailboxes,
	resolveBox,
} from "@/features/mail/queries/request-mail";
import { makeQueryClient } from "@/lib/query/query-client";

/**
 * The folder tree, streamed: it waits for the account's folders and hands them
 * to the client component, which owns them from then on. `asked` is the folder
 * of the address, if it names one. The page renders it inside `Suspense`, and
 * twice (the side pane and the sheet of a narrow screen); the folders are read
 * once per request all the same. The caller checks the session first.
 */
export async function FoldersBoundary({
	asked,
}: {
	asked: string | undefined;
}) {
	const client = makeQueryClient();
	const boxes = await requestMailboxes();
	if (boxes !== undefined) {
		client.setQueryData(mailKeys.mailboxes, boxes);
	}

	return (
		<HydrationBoundary state={dehydrate(client)}>
			<FolderPane activeId={await resolveBox(asked)} />
		</HydrationBoundary>
	);
}
