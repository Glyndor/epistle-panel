"use client";

import { useTranslations } from "next-intl";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { PasswordSection } from "@/features/account-detail/components/password-section";
import { TotpSection } from "@/features/account-detail/components/totp-section";
import type { AccountRow } from "@/features/accounts/schemas/accounts-view";

/**
 * What makes the account safe to use: the password it signs in with and the
 * second factor it may ask for. Both belong to an account the mail server
 * manages; one declared in the server's configuration file has neither, and
 * says so.
 */
export function SecuritySection({
	account,
	name,
}: {
	account: AccountRow;
	name: string;
}) {
	const t = useTranslations("accountDetail");

	if (!account.dynamic) {
		return (
			<Alert role="status">
				<AlertDescription>{t("configManaged")}</AlertDescription>
			</Alert>
		);
	}

	return (
		<>
			<PasswordSection name={name} />
			<TotpSection name={name} />
		</>
	);
}
