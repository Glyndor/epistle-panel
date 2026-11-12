import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

/** A query client for tests: no retries, so a failed query settles at once, and the
 * same 30 s freshness as the real one, so hydrated data is not fetched again. */
export function testQueryClient(): QueryClient {
	return new QueryClient({
		defaultOptions: {
			queries: { retry: false, gcTime: Infinity, staleTime: 30_000 },
		},
	});
}

/** Wrap `ui` in a fresh query client, the way the signed-in layout does for real. */
export function withQuery(
	ui: ReactNode,
	client = testQueryClient(),
): ReactNode {
	return <QueryClientProvider client={client}>{ui}</QueryClientProvider>;
}
