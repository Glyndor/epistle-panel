import { AccountsHeading } from "@/features/accounts/components/accounts-heading";
import { AccountsTableSkeleton } from "@/features/accounts/components/accounts-table-skeleton";
import { AdminBreadcrumbs } from "@/features/navigation/components/admin-breadcrumbs";
import { loadingRoutes } from "@/features/navigation/queries/loading-routes";

/**
 * Shown while the accounts page starts: its real heading and the skeleton its
 * table streams into. The list lives in a route group so this is not also the
 * first paint of an account's own page, the folder below.
 */
export default async function Loading() {
	const routes = await loadingRoutes();
	return (
		<>
			<AdminBreadcrumbs routes={routes} page="accounts" />
			<AccountsHeading />
			<AccountsTableSkeleton />
		</>
	);
}
