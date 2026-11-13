import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { AccountDetail } from "@/features/account-detail/components/account-detail";
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
import { parseAccountNameParam } from "@/lib/api/schemas";
import { requireAdmin } from "@/lib/auth/require-session";
import { prefetch } from "@/lib/query/prefetch";
import { getServerQueryClient } from "@/lib/query/server-query-client";

/**
 * The detail page of one account. The session is checked first, then the name
 * in the URL is parsed against the account-name rule: a name that is not one
 * (`..`, a path, a header, a non-ASCII letter) is a 404 before the API is asked
 * anything. The accounts list is read next, and a name that is not on it is a
 * 404 as well, so no per-account call is made for an account that is not there.
 * If the list cannot be read the page still renders and the client shows the
 * unreachable notice.
 */
export default async function AccountDetailPage({
	params,
}: {
	params: Promise<{ name: string }>;
}) {
	await requireAdmin();
	const name = parseAccountNameParam((await params).name);
	if (name === undefined) {
		notFound();
	}
	const client = getServerQueryClient();
	const accountsQuery = accountsQueryOptions(loadAccounts);
	await prefetch(client, accountsQuery, "accounts fetch");
	const accounts = client.getQueryData(accountsQuery.queryKey);
	if (accounts) {
		if (!accounts.some((row) => row.name === name)) {
			notFound();
		}
		await Promise.all([
			prefetch(
				client,
				mailboxesQueryOptions(name, () => loadMailboxes(name)),
				"account mailboxes",
			),
			prefetch(
				client,
				maskedQueryOptions(name, () => loadMasked(name)),
				"account masked",
			),
			prefetch(
				client,
				archiveQueryOptions(name, () => loadArchive(name)),
				"account archive",
			),
		]);
	}
	const t = await getTranslations("accountDetail");

	return (
		<>
			<h1 className="break-all font-semibold text-lg">
				{t("heading", { name })}
			</h1>
			<HydrationBoundary state={dehydrate(client)}>
				<AccountDetail name={name} />
			</HydrationBoundary>
		</>
	);
}
