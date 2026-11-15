import type { QueryClient } from "@tanstack/react-query";

/**
 * The `refetchInterval` a mounted component asked of the query `queryKey`, as
 * its observer holds it. A test reads it to know which interval a component
 * wired in, which no rendered text shows.
 */
export function observedInterval(
	client: QueryClient,
	queryKey: readonly unknown[],
): unknown {
	return client.getQueryCache().find({ queryKey })?.observers[0]?.options
		.refetchInterval;
}
