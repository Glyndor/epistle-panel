import { useTranslations } from "next-intl";

import { CreateAccountDialog } from "@/features/accounts/components/create-account-dialog";

/**
 * The top of the accounts page: its heading and the way to a new account. The
 * page and its `loading.tsx` both draw this one, so what is on screen while the
 * list is on its way is what stays there.
 */
export function AccountsHeading() {
	const t = useTranslations("accounts");

	return (
		<div className="flex min-h-8 flex-wrap items-center justify-between gap-2">
			<h1 className="font-semibold text-lg">{t("heading")}</h1>
			<CreateAccountDialog />
		</div>
	);
}
