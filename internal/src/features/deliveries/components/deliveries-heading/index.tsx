import { useTranslations } from "next-intl";

import { PageHeader } from "@/components/page-header";

/**
 * The top of the delivery log page: its heading and what it is for. The page and its
 * `loading.tsx` both draw this one, so what is on screen while the data is on
 * its way is what stays there.
 */
export function DeliveriesHeading() {
	const t = useTranslations("deliveries");

	return (
		<PageHeader
			icon="history"
			title={t("heading")}
			description={t("description")}
		/>
	);
}
