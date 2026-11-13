import { getTranslations } from "next-intl/server";

import { AccountsTableSkeleton } from "@/features/accounts/components/accounts-table-skeleton";

/** Shown while the accounts page starts: its real heading and the skeleton its table streams into. */
export default async function Loading() {
	const t = await getTranslations("accounts");
	return (
		<>
			<h1 className="font-semibold text-lg">{t("heading")}</h1>
			<AccountsTableSkeleton />
		</>
	);
}
