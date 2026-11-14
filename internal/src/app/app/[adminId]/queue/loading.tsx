import { getTranslations } from "next-intl/server";
import { QueueTableSkeleton } from "@/features/queue/components/queue-table-skeleton";

/** Shown while the queue page starts: its real heading and the skeleton its table streams into. */
export default async function Loading() {
	const t = await getTranslations("queue");
	return (
		<>
			<h1 className="font-semibold text-lg">{t("heading")}</h1>
			<QueueTableSkeleton />
		</>
	);
}
