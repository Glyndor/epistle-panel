import { getTranslations } from "next-intl/server";

import { PreferencesForm } from "@/features/preferences/components/preferences-form";
import { readPreferences } from "@/features/preferences/queries/read-preferences";
import { requireSession } from "@/lib/auth/require-session";
import { readOperatorRemoteImagesMode } from "@/lib/config/remote-images";

/**
 * The page of what is the person's own, at `/app/me`, for a session of any
 * role: the language, the theme, the density of the message list and the mode
 * of the remote images, in one form that works before any script loads. The
 * values come from the cookies, each checked against its own list
 * (`readPreferences`), so the first paint already shows the choice in force.
 * The mode of the remote images is the one the operator can take away, so the
 * page reads it too (`readOperatorRemoteImagesMode`) and says it instead of
 * asking. The proxy decides this exact route and gates it; the page asks for
 * the session itself too.
 */
export default async function MePage() {
	await requireSession();
	const t = await getTranslations("me");
	const values = await readPreferences();
	const operatorRemoteImagesMode = readOperatorRemoteImagesMode();

	return (
		<>
			<div className="flex max-w-2xl flex-col gap-1">
				<h1 className="font-semibold text-lg">{t("heading")}</h1>
				<p className="text-muted-foreground text-sm">{t("intro")}</p>
			</div>
			<PreferencesForm
				values={values}
				operatorRemoteImagesMode={operatorRemoteImagesMode}
			/>
		</>
	);
}
