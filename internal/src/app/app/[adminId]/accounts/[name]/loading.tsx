import { Skeleton } from "@/components/ui/skeleton";
import { AccountDetailSkeleton } from "@/features/account-detail/components/account-detail-skeleton";
import { AdminBreadcrumbs } from "@/features/navigation/components/admin-breadcrumbs";
import { loadingRoutes } from "@/features/navigation/queries/loading-routes";

/**
 * Shown while an account page starts. The heading names the account, which a
 * loading state is not given, so a bar holds the heading's line instead.
 */
export default async function Loading() {
	const routes = await loadingRoutes();
	return (
		<>
			<AdminBreadcrumbs routes={routes} page="accounts" leaf={null} />
			<Skeleton aria-hidden="true" className="h-7 w-56 rounded-md" />
			<AccountDetailSkeleton />
		</>
	);
}
