import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getTranslations } from "next-intl/server";

import { AccountsTable } from "@/features/accounts/components/accounts-table";
import { accountsQueryOptions } from "@/features/accounts/queries/accounts-query";
import { loadAccounts } from "@/features/accounts/queries/load-accounts";
import { requireAdmin } from "@/lib/auth/require-session";
import { prefetch } from "@/lib/query/prefetch";
import { getServerQueryClient } from "@/lib/query/server-query-client";

/** The accounts page: the list prefetched on the server, then owned by Query. */
export default async function AccountsPage() {
	await requireAdmin();
	const t = await getTranslations("accounts");
	const client = getServerQueryClient();
	await prefetch(
		client,
		accountsQueryOptions(loadAccounts),
		"accounts fetch",
	);

	return (
		<>
			<h1 className="font-semibold text-lg">{t("heading")}</h1>
			<HydrationBoundary state={dehydrate(client)}>
				<AccountsTable />
			</HydrationBoundary>
		</>
	);
}
