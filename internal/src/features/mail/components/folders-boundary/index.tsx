import "server-only";

import { FolderPane } from "@/features/mail/components/folder-pane";
import { requestMailboxes } from "@/features/mail/queries/request-mail";

/**
 * The folder tree, streamed: it waits for the account's folders and hands them
 * to the client component, which owns them from then on and marks the folder
 * the address shows. The mail area's layout renders it inside `Suspense`, in
 * the sidebar; the folders are read once per request, whoever else asks for
 * them. The caller checks the session first.
 *
 * The folders the server read are handed over as the tree's first paint, and
 * not only as the state of a query: the tree is in the page the server sends,
 * with its links, whether the browser has run yet or not. Another part of the
 * page may ask for the same folders before the tree is drawn (the search's
 * own list of folders does), and a query that is asked for twice is only
 * filled by the second reader, which would leave the tree waiting for the
 * browser.
 */
export async function FoldersBoundary() {
	const boxes = await requestMailboxes();

	return <FolderPane boxes={boxes} />;
}
