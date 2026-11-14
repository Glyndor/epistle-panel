import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { PrefetchBoundary } from "@/components/prefetch-boundary";
import { AccountDetail } from "@/features/account-detail/components/account-detail";
import { AccountDetailSkeleton } from "@/features/account-detail/components/account-detail-skeleton";
import {
	archiveQueryOptions,
	mailboxesQueryOptions,
	maskedQueryOptions,
} from "@/features/account-detail/queries/account-queries";
import { loadArchive } from "@/features/account-detail/queries/load-archive";
import { loadMailboxes } from "@/features/account-detail/queries/load-mailboxes";
import { loadMasked } from "@/features/account-detail/queries/load-masked";
import { accountsQueryOptions } from "@/features/accounts/queries/accounts-query";
import { loadAccounts } from "@/features/accounts/queries/load-accounts";
import { AdminBreadcrumbs } from "@/features/navigation/components/admin-breadcrumbs";
import { parseAccountNameParam } from "@/lib/api/schemas";
import { requireAdmin } from "@/lib/auth/require-session";
import { prefetch, prefetchSpec } from "@/lib/query/prefetch";
import { getServerQueryClient } from "@/lib/query/server-query-client";

/**
 * The detail page of one account. Everything that decides whether the page
 * exists runs before any of it is sent: the session, the name in the URL parsed
 * against the account-name rule (`..`, a path, a header or a non-ASCII letter is
 * a 404 before the API is asked anything) and the accounts list, on which a name
 * that is not there is a 404 too, so no per-account call is made for it. If the
 * list cannot be read the page still renders and the client shows the
 * unreachable notice. Then the heading paints and the per-account data streams
 * in.
 */
export default async function AccountDetailPage({
	params,
}: {
	params: Promise<{ name: string }>;
}) {
	const { routes } = await requireAdmin();
	const name = parseAccountNameParam((await params).name);
	if (name === undefined) {
		notFound();
	}
	const client = getServerQueryClient();
	const accountsQuery = accountsQueryOptions(loadAccounts);
	await prefetch(client, accountsQuery, "accounts fetch");
	const accounts = client.getQueryData(accountsQuery.queryKey);
	if (accounts && !accounts.some((row) => row.name === name)) {
		notFound();
	}
	const t = await getTranslations("accountDetail");
	const queries =
		accounts === undefined
			? []
			: [
					// Already read above: handed over, not asked again.
					prefetchSpec(
						accountsQueryOptions(async () => accounts),
						"accounts fetch",
					),
					prefetchSpec(
						mailboxesQueryOptions(name, () => loadMailboxes(name)),
						"account mailboxes",
					),
					prefetchSpec(
						maskedQueryOptions(name, () => loadMasked(name)),
						"account masked",
					),
					prefetchSpec(
						archiveQueryOptions(name, () => loadArchive(name)),
						"account archive",
					),
				];

	return (
		<>
			<AdminBreadcrumbs routes={routes} page="accounts" leaf={name} />
			<h1 className="break-all font-semibold text-lg">
				{t("heading", { name })}
			</h1>
			<Suspense fallback={<AccountDetailSkeleton />}>
				<PrefetchBoundary queries={queries}>
					<AccountDetail name={name} />
				</PrefetchBoundary>
			</Suspense>
		</>
	);
}
