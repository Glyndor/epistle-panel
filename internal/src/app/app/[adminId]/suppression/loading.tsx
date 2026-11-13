import { getTranslations } from "next-intl/server";
import { AdminBreadcrumbs } from "@/features/navigation/components/admin-breadcrumbs";
import { loadingRoutes } from "@/features/navigation/queries/loading-routes";
import { SuppressionTableSkeleton } from "@/features/suppression/components/suppression-table-skeleton";

/** Shown while the suppression page starts: its real heading and the skeleton its table streams into. */
export default async function Loading() {
	const routes = await loadingRoutes();
	const t = await getTranslations("suppression");
	return (
		<>
			<AdminBreadcrumbs routes={routes} page="suppression" />
			<h1 className="font-semibold text-lg">{t("heading")}</h1>
			<p className="text-muted-foreground">{t("description")}</p>
			<SuppressionTableSkeleton />
		</>
	);
}
