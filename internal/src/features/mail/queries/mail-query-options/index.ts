import { keepPreviousData, queryOptions } from "@tanstack/react-query";

import type { MessageListInput } from "@/features/mail/schemas/mail-input";
import type {
	MailboxView,
	MessageDetail,
	MessageListView,
} from "@/features/mail/schemas/mail-view";
import { MAIL_REFRESH_MS, mailKeys } from "../mail-query-keys";

/**
 * Options of the folder tree, shared by the server prefetch and the browser.
 * The counters refresh while the tab is in view and not while it is hidden.
 * `refreshMs` is the interval at the person's pace; it defaults to the normal
 * one, and the lists below take it the same way.
 */
export function mailboxesQueryOptions(
	fetcher: () => Promise<MailboxView[]>,
	refreshMs: number = MAIL_REFRESH_MS,
) {
	return queryOptions({
		queryKey: mailKeys.mailboxes,
		queryFn: fetcher,
		refetchInterval: refreshMs,
		refetchIntervalInBackground: false,
	});
}

/** Options of one page of a folder. The previous page stays on screen while the next loads. */
export function messageListQueryOptions(
	input: MessageListInput,
	fetcher: (input: MessageListInput) => Promise<MessageListView>,
	refreshMs: number = MAIL_REFRESH_MS,
) {
	return queryOptions({
		queryKey: mailKeys.list(input.box, input.page, input.conditions),
		queryFn: () => fetcher(input),
		placeholderData: keepPreviousData,
		refetchInterval: refreshMs,
		refetchIntervalInBackground: false,
	});
}

/** Options of one message, or `null` when the server has none. */
export function messageQueryOptions(
	id: string,
	fetcher: (id: string) => Promise<MessageDetail | null>,
) {
	return queryOptions({
		queryKey: mailKeys.message(id),
		queryFn: () => fetcher(id),
	});
}
