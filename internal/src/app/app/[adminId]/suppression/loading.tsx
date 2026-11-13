import { getTranslations } from "next-intl/server";

import { SuppressionTableSkeleton } from "@/features/suppression/components/suppression-table-skeleton";

/** Shown while the suppression page starts: its real heading and the skeleton its table streams into. */
export default async function Loading() {
	const t = await getTranslations("suppression");
	return (
		<>
			<h1 className="font-semibold text-lg">{t("heading")}</h1>
			<p className="text-muted-foreground">{t("description")}</p>
			<SuppressionTableSkeleton />
		</>
	);
}
