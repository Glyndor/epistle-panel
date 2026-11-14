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

/** One query a {@link prefetch} will run, with the operation name its failure is logged under. */
export interface PrefetchSpec {
	readonly run: (client: QueryClient) => Promise<void>;
}

/** Describe a prefetch without running it, so a list of different queries can be handed over. */
export function prefetchSpec<T, K extends QueryKey>(
	options: FetchQueryOptions<T, Error, T, K>,
	operation: string,
): PrefetchSpec {
	return { run: (client) => prefetch(client, options, operation) };
}
