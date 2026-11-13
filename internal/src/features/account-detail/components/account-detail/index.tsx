"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useAdminRoutes } from "@/components/layout/admin-routes";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { AccountDetailSkeleton } from "@/features/account-detail/components/account-detail-skeleton";
import { ArchiveSection } from "@/features/account-detail/components/archive-section";
import { MailboxesSection } from "@/features/account-detail/components/mailboxes-section";
import { MaskedSection } from "@/features/account-detail/components/masked-section";
import { PasswordSection } from "@/features/account-detail/components/password-section";
import { ProfileSection } from "@/features/account-detail/components/profile-section";
import { SectionCard } from "@/features/account-detail/components/section-card";
import { TotpSection } from "@/features/account-detail/components/totp-section";
import { getAccountsAction } from "@/features/accounts/actions/get-accounts";
import { accountsQueryOptions } from "@/features/accounts/queries/accounts-query";
import { unwrap } from "@/lib/query/action-result";

const fetchAccounts = async () => unwrap(await getAccountsAction());

/**
 * The detail page of one account: who it is, then a section for each thing the
 * API can change or show. The account comes from the accounts list the page
 * already prefetched (the API has no read of a single account). An account
 * declared in the configuration file is shown as it is, without the controls
 * the API would answer `404` for.
 */
export function AccountDetail({ name }: { name: string }) {
	const t = useTranslations("accountDetail");
	const routes = useAdminRoutes();
	const { data, isPending } = useQuery(accountsQueryOptions(fetchAccounts));
	const account = data?.find((row) => row.name === name);

	const back = (
		<Breadcrumb aria-label={t("breadcrumb")}>
			<BreadcrumbList>
				<BreadcrumbItem>
					<BreadcrumbLink asChild>
						<Link href={routes.accounts}>{t("back")}</Link>
					</BreadcrumbLink>
				</BreadcrumbItem>
				<BreadcrumbSeparator />
				<BreadcrumbItem>
					<BreadcrumbPage>{name}</BreadcrumbPage>
				</BreadcrumbItem>
			</BreadcrumbList>
		</Breadcrumb>
	);

	if (isPending) {
		return <AccountDetailSkeleton />;
	}
	if (data === undefined) {
		return (
			<>
				{back}
				<Alert variant="warning">
					<AlertDescription>{t("unreachable")}</AlertDescription>
				</Alert>
			</>
		);
	}
	if (account === undefined) {
		return (
			<>
				{back}
				<Alert variant="warning">
					<AlertDescription>{t("gone")}</AlertDescription>
				</Alert>
			</>
		);
	}

	return (
		<div className="flex max-w-3xl flex-col gap-4">
			{back}
			<SectionCard id="addresses" title={t("addresses")}>
				{account.addresses.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t("noAddresses")}
					</p>
				) : (
					<ul className="flex flex-col gap-1 font-mono text-sm">
						{account.addresses.map((address) => (
							<li key={address} className="break-all">
								{address}
							</li>
						))}
					</ul>
				)}
				{account.dynamic ? null : (
					<Alert role="status">
						<AlertDescription>
							{t("configManaged")}
						</AlertDescription>
					</Alert>
				)}
			</SectionCard>
			<ProfileSection account={account} />
			{account.dynamic ? (
				<>
					<PasswordSection name={name} />
					<TotpSection name={name} />
				</>
			) : null}
			<MailboxesSection name={name} />
			<MaskedSection name={name} />
			<ArchiveSection name={name} />
		</div>
	);
}
