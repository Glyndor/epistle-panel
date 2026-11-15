import { getLocale } from "next-intl/server";

import { readListDensity } from "@/features/mail/queries/list-density";
import type { PreferencesInput } from "@/features/preferences/schemas/preferences";
import { readThemeChoice } from "@/features/theme/queries/theme-choice";
import { DEFAULT_LOCALE, isSupportedLocale } from "@/i18n/locales";

/**
 * What the person has chosen, as the page shows it. Every part is checked
 * before it is handed on: the language is the one the request resolved (the
 * person's cookie, else the browser's, else the operator's, else English) and
 * is taken only if it is a shipped code, and the theme and the density are
 * read from their cookies by readers that believe nothing but a word of their
 * own list. Nothing of a cookie's text reaches the page.
 */
export async function readPreferences(): Promise<PreferencesInput> {
	const locale = await getLocale();
	const [theme, density] = await Promise.all([
		readThemeChoice(),
		readListDensity(),
	]);
	return {
		language: isSupportedLocale(locale) ? locale : DEFAULT_LOCALE,
		theme,
		density,
	};
}
