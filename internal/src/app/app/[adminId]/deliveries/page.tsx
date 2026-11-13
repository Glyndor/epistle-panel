import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { PrefetchBoundary } from "@/components/prefetch-boundary";
import { DeliveriesFilters } from "@/features/deliveries/components/deliveries-filters";
import { DeliveriesTable } from "@/features/deliveries/components/deliveries-table";
import { DeliveriesTableSkeleton } from "@/features/deliveries/components/deliveries-table-skeleton";
import { deliveriesQueryOptions } from "@/features/deliveries/queries/deliveries-query";
import { loadDeliveries } from "@/features/deliveries/queries/load-deliveries";
import { parseFilterParams } from "@/features/deliveries/schemas/deliveries-input";
import { requireAdmin } from "@/lib/auth/require-session";
import { prefetchSpec } from "@/lib/query/prefetch";

/**
 * The delivery log page: heading, description and the filter form at once (the
 * form needs no data), the records streamed in, then owned by Query. The
 * filters are parsed before anything is sent.
 */
export default async function DeliveriesPage({
	searchParams,
}: {
	searchParams: Promise<{
		outcome?: string | string[];
		since?: string | string[];
		recipient?: string | string[];
	}>;
}) {
	const { routes } = await requireAdmin();
	const t = await getTranslations("deliveries");
	const filters = parseFilterParams(await searchParams);

	return (
		<>
			<h1 className="font-semibold text-lg">{t("heading")}</h1>
			<p className="text-muted-foreground">{t("description")}</p>
			<DeliveriesFilters filters={filters} path={routes.deliveries} />
			<Suspense
				key={JSON.stringify(filters)}
				fallback={<DeliveriesTableSkeleton />}
			>
				<PrefetchBoundary
					queries={[
						prefetchSpec(
							deliveriesQueryOptions(filters, loadDeliveries),
							"deliveries fetch",
						),
					]}
				>
					<DeliveriesTable filters={filters} />
				</PrefetchBoundary>
			</Suspense>
		</>
	);
}
