import { type QueryClient, useQueryClient } from "@tanstack/react-query";
import { useMemo, useSyncExternalStore } from "react";

import { mailKeys } from "@/features/mail/queries/mail-query-keys";
import type {
	MailboxView,
	MessageListView,
	MessageSummary,
} from "@/features/mail/schemas/mail-view";

/** What the sidebar reads of the mail the browser has loaded. */
export interface LoadedMail {
	/** The messages of every page of a list in the cache, the page read most recently first. */
	readonly pages: readonly (readonly MessageSummary[])[];
	/** The account's folders, or `undefined` while the tree has not read them. */
	readonly boxes: readonly MailboxView[] | undefined;
}

/** The lists that hold data, the one filled last first. */
function loadedLists(client: QueryClient) {
	return client
		.getQueryCache()
		.findAll({ queryKey: mailKeys.lists })
		.filter((query) => query.state.data !== undefined)
		.sort((a, b) => b.state.dataUpdatedAt - a.state.dataUpdatedAt);
}

/**
 * What the cache holds of the lists and the folders, as one text that changes
 * when any of them is filled, refreshed or written to (a flag set in a row
 * counts: the cache counts it) and when one is dropped. A text, so that
 * `useSyncExternalStore` can tell by equality whether to draw again: a change
 * of the cache that is not data (a query that starts to fetch, an observer
 * that comes and goes) leaves it as it was.
 */
function signature(client: QueryClient): string {
	// The count too: two writes in one millisecond carry one time.
	const stamp = (state: { dataUpdatedAt: number; dataUpdateCount: number }) =>
		`${state.dataUpdatedAt}#${state.dataUpdateCount}`;
	const lists = loadedLists(client).map(
		(query) => `${query.queryHash}@${stamp(query.state)}`,
	);
	const boxes = client.getQueryState(mailKeys.mailboxes);
	return `${boxes === undefined ? 0 : stamp(boxes)}|${lists.join("|")}`;
}

/** What the server draws: its cache is not the browser's. */
const NOTHING = "";
const EMPTY: LoadedMail = { pages: [], boxes: undefined };

/**
 * The messages of the lists the browser holds and the folders, read from the
 * query cache and read again whenever one of them changes. It asks the server
 * for nothing: what it shows is what the lists the person opened already
 * carry, and it follows them (a refresh every 30 s while the tab is in view, a
 * flag changed in a row).
 *
 * The server and the first paint of the browser draw it with nothing and the
 * browser then reads the cache, so what hydrates is what was sent.
 */
export function useLoadedMail(): LoadedMail {
	const client = useQueryClient();
	const subscribe = useMemo(
		() => (notify: () => void) => client.getQueryCache().subscribe(notify),
		[client],
	);
	const read = useSyncExternalStore(
		subscribe,
		() => signature(client),
		() => NOTHING,
	);

	return useMemo(
		() =>
			read === NOTHING
				? EMPTY
				: {
						pages: loadedLists(client).map(
							(query) =>
								(query.state.data as MessageListView).items,
						),
						boxes: client.getQueryData<MailboxView[]>(
							mailKeys.mailboxes,
						),
					},
		[client, read],
	);
}
