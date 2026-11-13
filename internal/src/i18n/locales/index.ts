/**
 * Locales the panel ships messages for. This is the only list: the language
 * menu, the Server Action's schema, the cookie resolution, the message loader
 * and the tests all read it, so adding a locale starts and ends here (plus its
 * message files, see `docs/maintainers/i18n.md`). English comes first.
 */
export const SUPPORTED_LOCALES = ["en", "es", "pt", "fr", "de", "it"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

/**
 * Each locale's own name, written in that language. It is the same in every
 * interface language, so the menu shows it as is and marks it with `lang`.
 */
export const LOCALE_NAMES = {
	en: "English",
	es: "Español",
	pt: "Português",
	fr: "Français",
	de: "Deutsch",
	it: "Italiano",
} as const satisfies Record<(typeof SUPPORTED_LOCALES)[number], string>;

/** Locale used when the cookie is missing or holds anything else. */
export const DEFAULT_LOCALE: Locale = "en";

/** Name of the cookie that holds the chosen locale. */
export const LOCALE_COOKIE = "locale";

/** Whether a value is one of the {@link SUPPORTED_LOCALES}. */
export function isSupportedLocale(value: string | undefined): value is Locale {
	return SUPPORTED_LOCALES.includes(value as Locale);
}
