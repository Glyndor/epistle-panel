import { getTranslations } from "next-intl/server";
import { AdminBreadcrumbs } from "@/features/navigation/components/admin-breadcrumbs";
import { loadingRoutes } from "@/features/navigation/queries/loading-routes";
import { QueueTableSkeleton } from "@/features/queue/components/queue-table-skeleton";

/** Shown while the queue page starts: its real heading and the skeleton its table streams into. */
export default async function Loading() {
	const routes = await loadingRoutes();
	const t = await getTranslations("queue");
	return (
		<>
			<AdminBreadcrumbs routes={routes} page="queue" />
			<h1 className="font-semibold text-lg">{t("heading")}</h1>
			<QueueTableSkeleton />
		</>
	);
}
