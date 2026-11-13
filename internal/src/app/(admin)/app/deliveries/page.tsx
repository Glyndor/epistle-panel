import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getTranslations } from "next-intl/server";

import { DeliveriesFilters } from "@/features/deliveries/components/deliveries-filters";
import { DeliveriesTable } from "@/features/deliveries/components/deliveries-table";
import { deliveriesQueryOptions } from "@/features/deliveries/queries/deliveries-query";
import { loadDeliveries } from "@/features/deliveries/queries/load-deliveries";
import { parseFilterParams } from "@/features/deliveries/schemas/deliveries-input";
import { requireSession } from "@/lib/auth/require-session";
import { prefetch } from "@/lib/query/prefetch";
import { getServerQueryClient } from "@/lib/query/server-query-client";

/** The delivery log page: the records prefetched on the server, then owned by Query. */
export default async function DeliveriesPage({
	searchParams,
}: {
	searchParams: Promise<{
		outcome?: string | string[];
		since?: string | string[];
		recipient?: string | string[];
	}>;
}) {
	await requireSession();
	const t = await getTranslations("deliveries");
	const filters = parseFilterParams(await searchParams);
	const client = getServerQueryClient();
	await prefetch(
		client,
		deliveriesQueryOptions(filters, loadDeliveries),
		"deliveries fetch",
	);

	return (
		<>
			<h1 className="font-semibold text-lg">{t("heading")}</h1>
			<p className="text-muted-foreground">{t("description")}</p>
			<DeliveriesFilters filters={filters} />
			<HydrationBoundary state={dehydrate(client)}>
				<DeliveriesTable filters={filters} />
			</HydrationBoundary>
		</>
	);
}
