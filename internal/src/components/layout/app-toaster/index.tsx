import { getTranslations } from "next-intl/server";

import { Toaster } from "@/components/ui/toaster";

/** The shell's toast region, with its two texts translated on the server. */
export async function AppToaster() {
	const t = await getTranslations("nav");

	return <Toaster label={t("notifications")} closeLabel={t("dismiss")} />;
}
