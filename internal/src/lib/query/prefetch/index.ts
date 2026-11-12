import "server-only";

import type {
	FetchQueryOptions,
	QueryClient,
	QueryKey,
} from "@tanstack/react-query";

import { logApiFailure } from "@/lib/api/log-failure";

/**
 * Fetch a query into the request's client so the page can dehydrate it. A
 * failure is logged under a fixed operation name and swallowed: the page still
 * renders, the client fetches for itself through the Server Action and shows the
 * unreachable notice if that fails too. Only a successful fetch is dehydrated.
 */
export async function prefetch<T, K extends QueryKey>(
	client: QueryClient,
	options: FetchQueryOptions<T, Error, T, K>,
	operation: string,
): Promise<void> {
	try {
		// No retries: the client's default of two would triple the wait on a
		// hanging API, and the page can show without the data.
		await client.fetchQuery({ ...options, retry: false });
	} catch (error) {
		logApiFailure(operation, error);
	}
}
