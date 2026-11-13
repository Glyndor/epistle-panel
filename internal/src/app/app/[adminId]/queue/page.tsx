import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getTranslations } from "next-intl/server";

import { QueueTable } from "@/features/queue/components/queue-table";
import { loadQueue } from "@/features/queue/queries/load-queue";
import { queueQueryOptions } from "@/features/queue/queries/queue-query";
import { parseCursorParam } from "@/features/queue/schemas/queue-input";
import { requireAdmin } from "@/lib/auth/require-session";
import { prefetch } from "@/lib/query/prefetch";
import { getServerQueryClient } from "@/lib/query/server-query-client";

/** The outbound queue page: one page prefetched on the server, then owned by Query. */
export default async function QueuePage({
	searchParams,
}: {
	searchParams: Promise<{ cursor?: string | string[] }>;
}) {
	await requireAdmin();
	const t = await getTranslations("queue");
	const cursor = parseCursorParam((await searchParams).cursor);
	const client = getServerQueryClient();
	await prefetch(client, queueQueryOptions(cursor, loadQueue), "queue fetch");

	return (
		<>
			<h1 className="font-semibold text-lg">{t("heading")}</h1>
			<HydrationBoundary state={dehydrate(client)}>
				<QueueTable cursor={cursor} />
			</HydrationBoundary>
		</>
	);
}
