"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { lazy, Suspense, useMemo, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { AccountDetailSkeleton } from "@/features/account-detail/components/account-detail-skeleton";
import { AccountSectionErrorBoundary } from "@/features/account-detail/components/account-section/error-boundary";
import {
	type AccountSectionLoader,
	type AccountSectionProps,
	loadAccountSection,
} from "@/features/account-detail/components/account-section/load-section";
import type { AccountSection as Section } from "@/features/account-detail/schemas/account-section";
import { getAccountsAction } from "@/features/accounts/actions/get-accounts";
import { accountsQueryOptions } from "@/features/accounts/queries/accounts-query";
import type { AccountRow } from "@/features/accounts/schemas/accounts-view";
import { unwrap } from "@/lib/query/action-result";

const fetchAccounts = async () => unwrap(await getAccountsAction());

function sectionProps(
	section: Section,
	name: string,
	account: AccountRow,
): AccountSectionProps {
	switch (section) {
		case "overview":
			return { section, account };
		case "profile":
			return { section, account };
		case "security":
			return { section, account, name };
		case "mailboxes":
			return { section, name };
		case "masked":
			return { section, name };
		case "archive":
			return { section, name };
	}
}

/**
 * The section of the account page that the address names, and nothing else.
 *
 * The account itself is read from the accounts list, which the page has
 * already fetched: the API has no read of a single account. That read is what
 * a profile change invalidates, so the summary of the overview follows it.
 */
export function AccountSection({
	section,
	name,
	loader = loadAccountSection,
}: {
	/** The section the address names. */
	section: Section;
	/** The account the page is about. */
	name: string;
	loader?: AccountSectionLoader;
}) {
	const t = useTranslations("accountDetail");
	const [attempt, setAttempt] = useState(0);
	const Loaded = useMemo(
		() =>
			lazy(() =>
				loader(section, attempt).then((renderer) => ({
					default: renderer,
				})),
			),
		[attempt, loader, section],
	);
	const { data, isPending } = useQuery(accountsQueryOptions(fetchAccounts));
	const account = data?.find((row) => row.name === name);

	if (isPending) {
		return <AccountDetailSkeleton />;
	}
	if (data === undefined) {
		return (
			<Alert variant="warning">
				<AlertDescription>{t("unreachable")}</AlertDescription>
			</Alert>
		);
	}
	if (account === undefined) {
		return (
			<Alert variant="warning">
				<AlertDescription>{t("gone")}</AlertDescription>
			</Alert>
		);
	}

	return (
		<AccountSectionErrorBoundary
			key={`${section}-${attempt}`}
			failedMessage={t("sectionLoadFailed")}
			retryLabel={t("sectionRetry")}
			onRetry={() => setAttempt((current) => current + 1)}
		>
			<Suspense fallback={<AccountDetailSkeleton />}>
				<Loaded {...sectionProps(section, name, account)} />
			</Suspense>
		</AccountSectionErrorBoundary>
	);
}
