"use client";

import { useTranslations } from "next-intl";

import { SectionCard } from "@/features/account-detail/components/section-card";
import type { AccountRow } from "@/features/accounts/schemas/accounts-view";

/**
 * What the account is, at a glance: the addresses the mail server knows it by
 * and the name it sends with, both read-only. The display name is changed in
 * the profile section, and this summary follows that change, so it reads the
 * account from the same query the whole page reads.
 *
 * Nothing here is a form, so nothing here brings the form library: the
 * overview of an account is the one section a person may read on a machine
 * that never types in it.
 */
export function OverviewSection({ account }: { account: AccountRow }) {
	const t = useTranslations("accountDetail");

	return (
		<SectionCard id="overview" title={t("sectionOverview")}>
			<div className="flex flex-col gap-4">
				<div className="flex flex-col gap-1">
					<h3 className="font-semibold text-sm">{t("addresses")}</h3>
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
				</div>
				<div className="flex flex-col gap-1">
					<h3 className="font-semibold text-sm">
						{t("profileTitle")}
					</h3>
					<p className="text-sm">
						{account.displayName ?? t("displayNameNone")}
					</p>
				</div>
			</div>
		</SectionCard>
	);
}
