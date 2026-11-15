import { useTranslations } from "next-intl";

import { PageHeader } from "@/components/page-header";

/**
 * The top of the status page: its heading and what it is for. The page and its
 * `loading.tsx` both draw this one, so what is on screen while the data is on
 * its way is what stays there.
 */
export function StatusHeading() {
	const t = useTranslations("dashboard");

	return (
		<PageHeader
			icon="layout-dashboard"
			title={t("heading")}
			description={t("description")}
		/>
	);
}
