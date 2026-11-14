import { getTranslations } from "next-intl/server";

import { DomainsTableSkeleton } from "@/features/domains/components/domains-table-skeleton";

/** Shown while the domains page starts: its real heading and the skeleton its table streams into. */
export default async function Loading() {
	const t = await getTranslations("domains");
	return (
		<>
			<h1 className="font-semibold text-lg">{t("heading")}</h1>
			<DomainsTableSkeleton />
		</>
	);
}
