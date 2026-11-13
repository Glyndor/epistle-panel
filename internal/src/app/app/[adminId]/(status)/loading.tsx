import { getTranslations } from "next-intl/server";

import { StatusCardsSkeleton } from "@/features/status/components/status-cards-skeleton";

/**
 * Shown inside the shell while the status page starts: its real heading and
 * the skeleton its counters stream into, so nothing moves when they arrive.
 */
export default async function Loading() {
	const t = await getTranslations("dashboard");
	return (
		<>
			<h1 className="font-semibold text-lg">{t("heading")}</h1>
			<StatusCardsSkeleton />
		</>
	);
}
