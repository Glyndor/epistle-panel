import { Suspense } from "react";

import { PrefetchBoundary } from "@/components/prefetch-boundary";
import { QueueHeading } from "@/features/queue/components/queue-heading";
import { QueueTable } from "@/features/queue/components/queue-table";
import { QueueTableSkeleton } from "@/features/queue/components/queue-table-skeleton";
import { loadQueue } from "@/features/queue/queries/load-queue";
import { queueQueryOptions } from "@/features/queue/queries/queue-query";
import { parseCursorParam } from "@/features/queue/schemas/queue-input";
import { requireAdmin } from "@/lib/auth/require-session";
import { prefetchSpec } from "@/lib/query/prefetch";

/**
 * The outbound queue page: the heading at once, one page of the queue streamed
 * in, then owned by Query. The cursor is parsed before anything is sent.
 */
export default async function QueuePage({
	searchParams,
}: {
	searchParams: Promise<{ cursor?: string | string[] }>;
}) {
	await requireAdmin();
	const cursor = parseCursorParam((await searchParams).cursor);

	return (
		<>
			<QueueHeading />
			<Suspense key={cursor ?? ""} fallback={<QueueTableSkeleton />}>
				<PrefetchBoundary
					queries={[
						prefetchSpec(
							queueQueryOptions(cursor, loadQueue),
							"queue fetch",
						),
					]}
				>
					<QueueTable cursor={cursor} />
				</PrefetchBoundary>
			</Suspense>
		</>
	);
}
