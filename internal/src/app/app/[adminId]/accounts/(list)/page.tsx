import { Suspense } from "react";

import { PrefetchBoundary } from "@/components/prefetch-boundary";
import { AccountsHeading } from "@/features/accounts/components/accounts-heading";
import { AccountsTable } from "@/features/accounts/components/accounts-table";
import { AccountsTableSkeleton } from "@/features/accounts/components/accounts-table-skeleton";
import { accountsQueryOptions } from "@/features/accounts/queries/accounts-query";
import { loadAccounts } from "@/features/accounts/queries/load-accounts";
import { AdminBreadcrumbs } from "@/features/navigation/components/admin-breadcrumbs";
import { requireAdmin } from "@/lib/auth/require-session";
import { prefetchSpec } from "@/lib/query/prefetch";

/** The accounts page: the heading and the way to a new account at once, the list streamed in, then owned by Query. */
export default async function AccountsPage() {
	const { routes } = await requireAdmin();

	return (
		<>
			<AdminBreadcrumbs routes={routes} page="accounts" />
			<AccountsHeading />
			<Suspense fallback={<AccountsTableSkeleton />}>
				<PrefetchBoundary
					queries={[
						prefetchSpec(
							accountsQueryOptions(loadAccounts),
							"accounts fetch",
						),
					]}
				>
					<AccountsTable />
				</PrefetchBoundary>
			</Suspense>
		</>
	);
}
