import { getTranslations } from "next-intl/server";

import { DeliveriesFilters } from "@/features/deliveries/components/deliveries-filters";
import { DeliveriesTableSkeleton } from "@/features/deliveries/components/deliveries-table-skeleton";
import { parseFilterParams } from "@/features/deliveries/schemas/deliveries-input";
import { AdminBreadcrumbs } from "@/features/navigation/components/admin-breadcrumbs";
import { loadingRoutes } from "@/features/navigation/queries/loading-routes";
import { readAdminId } from "@/lib/config/admin-id";
import { adminRoutes, PUBLIC_ROUTES } from "@/lib/routes";

/**
 * Shown while the delivery log starts: its real heading, description and the
 * filter form (it needs no data, so it is drawn as it will be, empty), then
 * the skeleton the records stream into.
 */
export default async function Loading() {
	const routes = await loadingRoutes();
	const t = await getTranslations("deliveries");
	// The layout above already settled who may be here.
	const id = await readAdminId();
	const path =
		id === undefined ? PUBLIC_ROUTES.root : adminRoutes(id).deliveries;
	return (
		<>
			<AdminBreadcrumbs routes={routes} page="deliveries" />
			<h1 className="font-semibold text-lg">{t("heading")}</h1>
			<p className="text-muted-foreground">{t("description")}</p>
			<DeliveriesFilters filters={parseFilterParams({})} path={path} />
			<DeliveriesTableSkeleton />
		</>
	);
}
