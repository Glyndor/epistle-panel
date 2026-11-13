import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getTranslations } from "next-intl/server";

import { StatusCards } from "@/features/status/components/status-cards";
import { loadStatus } from "@/features/status/queries/load-status";
import { statusQueryOptions } from "@/features/status/queries/status-query";
import { requireAdmin } from "@/lib/auth/require-session";
import { prefetch } from "@/lib/query/prefetch";
import { getServerQueryClient } from "@/lib/query/server-query-client";

/** The status page: counters prefetched on the server, refreshed by the client. */
export default async function HomePage() {
	await requireAdmin();
	const t = await getTranslations("dashboard");
	const client = getServerQueryClient();
	await prefetch(client, statusQueryOptions(loadStatus), "status fetch");

	return (
		<>
			<h1 className="font-semibold text-lg">{t("heading")}</h1>
			<HydrationBoundary state={dehydrate(client)}>
				<StatusCards />
			</HydrationBoundary>
		</>
	);
}
