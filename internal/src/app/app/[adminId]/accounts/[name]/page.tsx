import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { PrefetchBoundary } from "@/components/prefetch-boundary";
import { AccountDetailSkeleton } from "@/features/account-detail/components/account-detail-skeleton";
import { AccountSection } from "@/features/account-detail/components/account-section";
import { AccountSectionNav } from "@/features/account-detail/components/account-section-nav";
import {
	archiveQueryOptions,
	mailboxesQueryOptions,
	maskedQueryOptions,
} from "@/features/account-detail/queries/account-queries";
import { loadArchive } from "@/features/account-detail/queries/load-archive";
import { loadMailboxes } from "@/features/account-detail/queries/load-mailboxes";
import { loadMasked } from "@/features/account-detail/queries/load-masked";
import {
	accountSectionNeedsAccount,
	parseSectionParam,
	type AccountSection as Section,
} from "@/features/account-detail/schemas/account-section";
import { accountsQueryOptions } from "@/features/accounts/queries/accounts-query";
import { loadAccounts } from "@/features/accounts/queries/load-accounts";
import type { AccountRow } from "@/features/accounts/schemas/accounts-view";
import { type AccountName, parseAccountNameParam } from "@/lib/api/schemas";
import { requireAdmin } from "@/lib/auth/require-session";
import {
	type PrefetchSpec,
	prefetch,
	prefetchSpec,
} from "@/lib/query/prefetch";
import { getServerQueryClient } from "@/lib/query/server-query-client";

/**
 * The data the section on screen needs: the accounts list for the sections
 * that show the account, and, for the section that lists something of the
 * account, its own dataset. The datasets of the other sections are not asked
 * for at all.
 */
async function sectionQueries(
	section: Section,
	name: AccountName,
): Promise<PrefetchSpec[]> {
	const client = getServerQueryClient();
	switch (section) {
		case "mailboxes": {
			const query = mailboxesQueryOptions(name, () =>
				loadMailboxes(name),
			);
			await prefetch(client, query, "account mailboxes");
			const mailboxes = client.getQueryData(query.queryKey);
			return mailboxes === undefined
				? []
				: [
						prefetchSpec(
							mailboxesQueryOptions(name, async () => mailboxes),
							"account mailboxes",
						),
					];
		}
		case "masked": {
			const query = maskedQueryOptions(name, () => loadMasked(name));
			await prefetch(client, query, "account masked");
			const masked = client.getQueryData(query.queryKey);
			return masked === undefined
				? []
				: [
						prefetchSpec(
							maskedQueryOptions(name, async () => masked),
							"account masked",
						),
					];
		}
		case "archive": {
			const query = archiveQueryOptions(name, () => loadArchive(name));
			await prefetch(client, query, "account archive");
			const archive = client.getQueryData(query.queryKey);
			return archive === undefined
				? []
				: [
						prefetchSpec(
							archiveQueryOptions(name, async () => archive),
							"account archive",
						),
					];
		}
		default:
			return [];
	}
}

/**
 * The detail page of one account. Everything that decides whether the page
 * exists runs before any of it is sent: the session, the name in the URL parsed
 * against the account-name rule (`..`, a path, a header or a non-ASCII letter is
 * a 404 before the API is asked anything) and the accounts list, on which a name
 * that is not there is a 404 too, so no per-account call is made for it. If the
 * list cannot be read the page still renders and the client shows the
 * unreachable notice. Then the heading paints, the sections are offered as
 * links, and the section the address names streams in.
 */
export default async function AccountDetailPage({
	params,
	searchParams,
}: {
	params: Promise<{ name: string }>;
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
	const { routes } = await requireAdmin();
	const name = parseAccountNameParam((await params).name);
	if (name === undefined) {
		notFound();
	}
	const section = parseSectionParam((await searchParams)["section"]);
	const needsAccount = accountSectionNeedsAccount(section);
	const client = getServerQueryClient();
	const accountsQuery = accountsQueryOptions(loadAccounts);
	let accounts: readonly AccountRow[] | undefined;
	if (needsAccount) {
		await prefetch(client, accountsQuery, "accounts fetch");
		accounts = client.getQueryData(accountsQuery.queryKey);
		if (accounts && !accounts.some((row) => row.name === name)) {
			notFound();
		}
	}
	const t = await getTranslations("accountDetail");
	const queries = [
		...(accounts === undefined
			? []
			: [
					prefetchSpec(
						accountsQueryOptions(async () => accounts),
						"accounts fetch",
					),
				]),
		...(await sectionQueries(section, name)),
	];

	return (
		<>
			<h1 className="break-all font-semibold text-lg">
				{t("heading", { name })}
			</h1>
			<AccountSectionNav
				base={routes.accountDetail(name)}
				section={section}
				label={t("sectionsLabel")}
				names={{
					overview: t("sectionOverview"),
					profile: t("profileTitle"),
					security: t("sectionSecurity"),
					mailboxes: t("mailboxesTitle"),
					masked: t("maskedTitle"),
					archive: t("archiveTitle"),
				}}
			/>
			<Suspense fallback={<AccountDetailSkeleton section={section} />}>
				<PrefetchBoundary queries={queries}>
					<AccountSection section={section} name={name} />
				</PrefetchBoundary>
			</Suspense>
		</>
	);
}
