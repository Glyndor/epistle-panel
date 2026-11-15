import { getLocale } from "next-intl/server";
import { readListDensity } from "@/features/mail/queries/list-density";
import { readEffectivePageSize } from "@/features/mail/queries/page-size";
import { readEffectiveRemoteImagesMode } from "@/features/mail/queries/remote-images";
import type { PreferencesValues } from "@/features/preferences/schemas/preferences";
import { readChosenRefreshPace } from "@/features/refresh/queries/refresh-pace";
import { readThemeChoice } from "@/features/theme/queries/theme-choice";
import { readEffectiveTimeZone } from "@/features/time-zone/queries/time-zone";
import { DEFAULT_LOCALE, isSupportedLocale } from "@/i18n/locales";

/**
 * What the person has chosen, as the page shows it. Every part is checked
 * before it is handed on: the language is the one the request resolved (the
 * person's cookie, else the browser's, else the operator's, else English) and
 * is taken only if it is a shipped code, and the theme, the density, the mode
 * of the remote images, the time zone, the page size and the refresh pace are read by readers that believe
 * nothing but a word of their own list. Nothing of a cookie's text reaches
 * the page.
 */
export async function readPreferences(): Promise<PreferencesValues> {
	const locale = await getLocale();
	const [theme, density, remoteImages, timeZone, pageSize, refresh] =
		await Promise.all([
			readThemeChoice(),
			readListDensity(),
			readEffectiveRemoteImagesMode(),
			readEffectiveTimeZone(),
			readEffectivePageSize(),
			readChosenRefreshPace(),
		]);
	return {
		language: isSupportedLocale(locale) ? locale : DEFAULT_LOCALE,
		theme,
		density,
		remoteImages,
		timeZone,
		pageSize,
		refresh,
	};
}
