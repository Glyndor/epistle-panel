import { QueryCache, QueryClient } from "@tanstack/react-query";

import { ActionError } from "@/lib/query/action-result";

/** How long fetched data counts as fresh, in milliseconds. */
export const STALE_TIME_MS = 30_000;

/** How long unused data stays cached, in milliseconds. */
export const GC_TIME_MS = 5 * 60_000;

/**
 * How long unused data stays cached where the client lives. In the browser,
 * {@link GC_TIME_MS}. On the server the client is made for one request and
 * dropped with it, so it never collects by timer: a timer of five minutes per
 * prefetched query kept the whole request (its response, its queries, its
 * formatters) alive for that long, and the memory of the server grew with the
 * request rate (measured: about 55 MB of heap per 200 requests to a page).
 */
export function gcTimeFor(onServer: boolean): number {
	return onServer ? Number.POSITIVE_INFINITY : GC_TIME_MS;
}

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
 * hydrates, and in the browser unused data is dropped after 5 minutes (never by timer
 * on the server, see {@link gcTimeFor}). `onUnauthenticated`
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
				gcTime: gcTimeFor(typeof window === "undefined"),
				retry: shouldRetry,
			},
		},
	});
}
