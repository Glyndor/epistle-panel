import { useTranslations } from "next-intl";

import { Trail } from "@/components/layout/trail";

/** The trail of the preferences page, in the bar above it: the page alone, as the current step. */
export function MeTrail() {
	const t = useTranslations("nav");

	return (
		<Trail
			label={t("breadcrumb")}
			steps={[{ key: "me", text: t("preferences"), current: true }]}
		/>
	);
}
