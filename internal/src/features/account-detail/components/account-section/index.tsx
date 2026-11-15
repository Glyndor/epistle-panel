"use client";

import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { AccountDetailSkeleton } from "@/features/account-detail/components/account-detail-skeleton";
import type { AccountSection as Section } from "@/features/account-detail/schemas/account-section";
import { getAccountsAction } from "@/features/accounts/actions/get-accounts";
import { accountsQueryOptions } from "@/features/accounts/queries/accounts-query";
import { unwrap } from "@/lib/query/action-result";

/**
 * Each section is its own chunk: the code of a section is fetched when that
 * section is the one on screen, so a visit to the overview does not carry the
 * form library of the profile or the password section. The chunk arrives
 * inside its own `Suspense` (the `loading` of `next/dynamic`), so the page is
 * never suspended by it: the frame and the heading paint at once, and the
 * section streams in behind its skeleton.
 */
const OverviewPanel = dynamic(
	() =>
		import("@/features/account-detail/components/overview-section").then(
			(module) => module.OverviewSection,
		),
	{ loading: AccountDetailSkeleton },
);

const ProfilePanel = dynamic(
	() =>
		import("@/features/account-detail/components/profile-section").then(
			(module) => module.ProfileSection,
		),
	{ loading: AccountDetailSkeleton },
);

const SecurityPanel = dynamic(
	() =>
		import("@/features/account-detail/components/security-section").then(
			(module) => module.SecuritySection,
		),
	{ loading: AccountDetailSkeleton },
);

const MailboxesPanel = dynamic(
	() =>
		import("@/features/account-detail/components/mailboxes-section").then(
			(module) => module.MailboxesSection,
		),
	{ loading: AccountDetailSkeleton },
);

const MaskedPanel = dynamic(
	() =>
		import("@/features/account-detail/components/masked-section").then(
			(module) => module.MaskedSection,
		),
	{ loading: AccountDetailSkeleton },
);

const ArchivePanel = dynamic(
	() =>
		import("@/features/account-detail/components/archive-section").then(
			(module) => module.ArchiveSection,
		),
	{ loading: AccountDetailSkeleton },
);

const fetchAccounts = async () => unwrap(await getAccountsAction());

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
}: {
	/** The section the address names. */
	section: Section;
	/** The account the page is about. */
	name: string;
}) {
	const t = useTranslations("accountDetail");
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

	switch (section) {
		case "overview":
			return <OverviewPanel account={account} />;
		case "profile":
			return <ProfilePanel account={account} />;
		case "security":
			return <SecurityPanel account={account} name={name} />;
		case "mailboxes":
			return <MailboxesPanel name={name} />;
		case "masked":
			return <MaskedPanel name={name} />;
		case "archive":
			return <ArchivePanel name={name} />;
	}
}
