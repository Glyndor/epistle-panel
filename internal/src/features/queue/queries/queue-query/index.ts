import { keepPreviousData, queryOptions } from "@tanstack/react-query";

import type { QueuePageView } from "@/features/queue/schemas/queue-view";

/** Query keys of the queue feature. A page is keyed by its cursor, `null` for the first. */
export const queueKeys = {
	all: ["queue"] as const,
	page: (cursor: string | undefined) =>
		["queue", "page", cursor ?? null] as const,
};

/** How often the queue refreshes while the tab is in view, in milliseconds. */
export const QUEUE_REFRESH_MS = 15_000;

/**
 * Options of one page of the queue, shared by the server prefetch and the
 * browser. The previous page stays on screen while the next loads, so moving
 * between pages does not flash an empty table. Polls only while the tab is in
 * view.
 */
export function queueQueryOptions(
	cursor: string | undefined,
	fetcher: (cursor: string | undefined) => Promise<QueuePageView>,
) {
	return queryOptions({
		queryKey: queueKeys.page(cursor),
		queryFn: () => fetcher(cursor),
		placeholderData: keepPreviousData,
		refetchInterval: QUEUE_REFRESH_MS,
		refetchIntervalInBackground: false,
	});
}
