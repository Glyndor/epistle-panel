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
	parseSectionParam,
	type AccountSection as Section,
} from "@/features/account-detail/schemas/account-section";
import { accountsQueryOptions } from "@/features/accounts/queries/accounts-query";
import { loadAccounts } from "@/features/accounts/queries/load-accounts";
import { type AccountName, parseAccountNameParam } from "@/lib/api/schemas";
import { requireAdmin } from "@/lib/auth/require-session";
import {
	type PrefetchSpec,
	prefetch,
	prefetchSpec,
} from "@/lib/query/prefetch";
import { getServerQueryClient } from "@/lib/query/server-query-client";

/**
 * The data the section on screen needs: the accounts list, which every section
 * reads, and, for the section that lists something of the account, its own
 * dataset. The datasets of the other sections are not asked for at all, so a
 * visit to the overview asks the API for nothing but the list.
 */
function sectionQueries(section: Section, name: AccountName): PrefetchSpec[] {
	switch (section) {
		case "mailboxes":
			return [
				prefetchSpec(
					mailboxesQueryOptions(name, () => loadMailboxes(name)),
					"account mailboxes",
				),
			];
		case "masked":
			return [
				prefetchSpec(
					maskedQueryOptions(name, () => loadMasked(name)),
					"account masked",
				),
			];
		case "archive":
			return [
				prefetchSpec(
					archiveQueryOptions(name, () => loadArchive(name)),
					"account archive",
				),
			];
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
					...sectionQueries(section, name),
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
			<Suspense fallback={<AccountDetailSkeleton />}>
				<PrefetchBoundary queries={queries}>
					<AccountSection section={section} name={name} />
				</PrefetchBoundary>
			</Suspense>
		</>
	);
}
