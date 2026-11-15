import { useTranslations } from "next-intl";

import { PageHeader } from "@/components/page-header";
import { CreateAccountDialog } from "@/features/accounts/components/create-account-dialog";

/**
 * The top of the accounts page: its heading, what it is for and the way to a
 * new account. The page and its `loading.tsx` both draw this one, so what is
 * on screen while the list is on its way is what stays there.
 */
export function AccountsHeading() {
	const t = useTranslations("accounts");

	return (
		<PageHeader
			icon="users"
			title={t("heading")}
			description={t("description")}
			actions={<CreateAccountDialog />}
		/>
	);
}
