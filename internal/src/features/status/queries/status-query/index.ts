import { queryOptions } from "@tanstack/react-query";

import type { StatusView } from "@/features/status/schemas/status-view";

/** Query keys of the status feature, from one place. */
export const statusKeys = {
	all: ["status"] as const,
};

/** How often the counters refresh while the tab is in view, in milliseconds. */
export const STATUS_REFRESH_MS = 15_000;

/**
 * Options of the status query. The same options serve the server prefetch (with
 * the direct loader) and the browser (with the Server Action), so the key and the
 * data shape cannot drift apart. The interval pauses while the tab is hidden:
 * `refetchIntervalInBackground` is off, which is also Query's default, written
 * down because the counters are the part that polls.
 */
export function statusQueryOptions(fetcher: () => Promise<StatusView>) {
	return queryOptions({
		queryKey: statusKeys.all,
		queryFn: fetcher,
		refetchInterval: STATUS_REFRESH_MS,
		refetchIntervalInBackground: false,
	});
}
