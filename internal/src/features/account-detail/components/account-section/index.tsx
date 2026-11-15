"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import {
	type LazyExoticComponent,
	lazy,
	type ReactNode,
	Suspense,
	useMemo,
	useRef,
	useState,
} from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { AccountDetailSkeleton } from "@/features/account-detail/components/account-detail-skeleton";
import { AccountSectionErrorBoundary } from "@/features/account-detail/components/account-section/error-boundary";
import {
	type AccountSectionLoader,
	type AccountSectionProps,
	type AccountSectionRenderer,
	loadAccountSection,
} from "@/features/account-detail/components/account-section/load-section";
import type { AccountSection as Section } from "@/features/account-detail/schemas/account-section";
import { getAccountsAction } from "@/features/accounts/actions/get-accounts";
import { accountsQueryOptions } from "@/features/accounts/queries/accounts-query";
import type { AccountRow } from "@/features/accounts/schemas/accounts-view";
import { unwrap } from "@/lib/query/action-result";

const fetchAccounts = async () => unwrap(await getAccountsAction());

type LoadedSection = LazyExoticComponent<AccountSectionRenderer>;
type AccountSectionWithAccount = "overview" | "profile" | "security";
type AccountSectionWithoutAccount = "mailboxes" | "masked" | "archive";

function sectionProps(
	section: Section,
	name: string,
	account: AccountRow | undefined,
): AccountSectionProps {
	switch (section) {
		case "overview":
			return { section, account: account as AccountRow };
		case "profile":
			return { section, account: account as AccountRow };
		case "security":
			return { section, account: account as AccountRow, name };
		case "mailboxes":
			return { section, name };
		case "masked":
			return { section, name };
		case "archive":
			return { section, name };
	}
}

function AccountSectionWithAccount({
	section,
	name,
	Loaded,
}: {
	section: AccountSectionWithAccount;
	name: string;
	Loaded: LoadedSection;
}) {
	const t = useTranslations("accountDetail");
	const { data, isPending } = useQuery({
		...accountsQueryOptions(fetchAccounts),
		staleTime: Infinity,
	});
	const account = data?.find((row) => row.name === name);

	if (isPending) {
		return <AccountDetailSkeleton section={section} />;
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

	return <Loaded {...sectionProps(section, name, account)} />;
}

function AccountSectionWithoutAccount({
	section,
	name,
	Loaded,
}: {
	section: AccountSectionWithoutAccount;
	name: string;
	Loaded: LoadedSection;
}) {
	return <Loaded {...sectionProps(section, name, undefined)} />;
}

function sectionContent(
	section: Section,
	name: string,
	Loaded: LoadedSection,
): ReactNode {
	switch (section) {
		case "overview":
		case "profile":
		case "security":
			return (
				<AccountSectionWithAccount
					section={section}
					name={name}
					Loaded={Loaded}
				/>
			);
		case "mailboxes":
		case "masked":
		case "archive":
			return (
				<AccountSectionWithoutAccount
					section={section}
					name={name}
					Loaded={Loaded}
				/>
			);
	}
}

/**
 * The section of the account page that the address names, and nothing else.
 *
 * The sections that show the account read it from the accounts list, which
 * the page has already fetched: the API has no read of a single account. That
 * read is what a profile change invalidates, so the summary of the overview
 * follows it. The list sections ask only for their own dataset.
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
	const region = useRef<HTMLDivElement>(null);
	const Loaded = useMemo(
		() =>
			lazy(() =>
				loader(section, attempt).then((renderer) => ({
					default: renderer,
				})),
			),
		[attempt, loader, section],
	);

	return (
		// The retry button leaves the page while the section loads again, so the
		// focus moves to this region, which stays, before that happens.
		<div ref={region} tabIndex={-1} className="outline-none">
			<AccountSectionErrorBoundary
				key={`${section}-${attempt}`}
				failedMessage={t("sectionLoadFailed")}
				retryLabel={t("sectionRetry")}
				onRetry={() => {
					region.current?.focus();
					setAttempt((current) => current + 1);
				}}
			>
				<Suspense
					fallback={<AccountDetailSkeleton section={section} />}
				>
					{sectionContent(section, name, Loaded)}
				</Suspense>
			</AccountSectionErrorBoundary>
		</div>
	);
}
