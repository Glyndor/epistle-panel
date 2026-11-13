import { queryOptions } from "@tanstack/react-query";

import type {
	ArchiveView,
	MailboxRow,
	MaskedRow,
} from "@/features/account-detail/schemas/account-views";

/** Query keys of the account detail page. Each is scoped by the account name. */
export const accountDetailKeys = {
	mailboxes: (name: string) => ["account", name, "mailboxes"] as const,
	masked: (name: string) => ["account", name, "masked"] as const,
	archive: (name: string) => ["account", name, "archive"] as const,
};

/** Options of the mailboxes query, shared by the server prefetch and the browser. */
export function mailboxesQueryOptions(
	name: string,
	fetcher: () => Promise<readonly MailboxRow[]>,
) {
	return queryOptions({
		queryKey: accountDetailKeys.mailboxes(name),
		queryFn: fetcher,
	});
}

/** Options of the masked-addresses query. */
export function maskedQueryOptions(
	name: string,
	fetcher: () => Promise<readonly MaskedRow[]>,
) {
	return queryOptions({
		queryKey: accountDetailKeys.masked(name),
		queryFn: fetcher,
	});
}

/** Options of the archive query. */
export function archiveQueryOptions(
	name: string,
	fetcher: () => Promise<ArchiveView>,
) {
	return queryOptions({
		queryKey: accountDetailKeys.archive(name),
		queryFn: fetcher,
	});
}
