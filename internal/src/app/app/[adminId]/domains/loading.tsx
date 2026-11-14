import { getTranslations } from "next-intl/server";

import { DomainsTableSkeleton } from "@/features/domains/components/domains-table-skeleton";
import { AdminBreadcrumbs } from "@/features/navigation/components/admin-breadcrumbs";
import { loadingRoutes } from "@/features/navigation/queries/loading-routes";

/** Shown while the domains page starts: its real heading and the skeleton its table streams into. */
export default async function Loading() {
	const routes = await loadingRoutes();
	const t = await getTranslations("domains");
	return (
		<>
			<AdminBreadcrumbs routes={routes} page="domains" />
			<h1 className="font-semibold text-lg">{t("heading")}</h1>
			<DomainsTableSkeleton />
		</>
	);
}
