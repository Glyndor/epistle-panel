import "server-only";

import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

import type { PrefetchSpec } from "@/lib/query/prefetch";
import { makeQueryClient } from "@/lib/query/query-client";

/**
 * The part of a page that waits for the API. It runs its queries in parallel
 * into a query client of its own and hands what came back to the client
 * components below it, which own the data from then on. A page renders it
 * inside `Suspense`, so the frame and the heading paint before the API answers
 * and the slow part streams in.
 *
 * The client is its own, not the request's shared one: two boundaries on one
 * page would otherwise each dehydrate the other's data as well. A failed query
 * is logged and left out, and the client component fetches it for itself. The
 * caller checks the session before it renders this.
 */
export async function PrefetchBoundary({
	queries,
	children,
}: {
	queries: readonly PrefetchSpec[];
	children: React.ReactNode;
}) {
	const client = makeQueryClient();
	await Promise.all(queries.map((query) => query.run(client)));
	return (
		<HydrationBoundary state={dehydrate(client)}>
			{children}
		</HydrationBoundary>
	);
}
