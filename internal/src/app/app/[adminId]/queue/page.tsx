import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { PrefetchBoundary } from "@/components/prefetch-boundary";
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
	const t = await getTranslations("queue");
	const cursor = parseCursorParam((await searchParams).cursor);

	return (
		<>
			<h1 className="font-semibold text-lg">{t("heading")}</h1>
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
