import { QueryCache, QueryClient } from "@tanstack/react-query";

import { ActionError } from "@/lib/query/action-result";

/** How long fetched data counts as fresh, in milliseconds. */
export const STALE_TIME_MS = 30_000;

/** How long unused data stays cached, in milliseconds. */
export const GC_TIME_MS = 5 * 60_000;

/** Whether a failed query is worth another try: not when the session is gone. */
export function shouldRetry(failures: number, error: unknown): boolean {
	if (error instanceof ActionError && error.reason === "unauthenticated") {
		return false;
	}
	return failures < 2;
}

/**
 * Build a query client with the panel's defaults. Data stays fresh for 30 s, so
 * a page that was prefetched on the server is not fetched again the moment it
 * hydrates, and unused data is dropped after 5 minutes. `onUnauthenticated`
 * runs when any query reports that the session has ended.
 */
export function makeQueryClient(onUnauthenticated?: () => void): QueryClient {
	return new QueryClient({
		queryCache: new QueryCache({
			onError: (error) => {
				if (
					error instanceof ActionError &&
					error.reason === "unauthenticated"
				) {
					onUnauthenticated?.();
				}
			},
		}),
		defaultOptions: {
			queries: {
				staleTime: STALE_TIME_MS,
				gcTime: GC_TIME_MS,
				retry: shouldRetry,
			},
		},
	});
}
