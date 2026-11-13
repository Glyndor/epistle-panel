import { getTranslations } from "next-intl/server";
import { AdminBreadcrumbs } from "@/features/navigation/components/admin-breadcrumbs";
import { loadingRoutes } from "@/features/navigation/queries/loading-routes";
import { StatusCardsSkeleton } from "@/features/status/components/status-cards-skeleton";

/**
 * Shown inside the shell while the status page starts: its real heading and
 * the skeleton its counters stream into, so nothing moves when they arrive.
 *
 * The status page lives in a route group so that this file is its loading
 * state alone. Next to the layout it was also the first thing every other
 * admin page painted: measured in Chromium against the built server, a load of
 * the domains page showed the Status heading before its own.
 */
export default async function Loading() {
	const routes = await loadingRoutes();
	const t = await getTranslations("dashboard");
	return (
		<>
			<AdminBreadcrumbs routes={routes} page="status" />
			<h1 className="font-semibold text-lg">{t("heading")}</h1>
			<StatusCardsSkeleton />
		</>
	);
}
