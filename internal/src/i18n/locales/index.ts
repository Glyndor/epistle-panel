/** Locales the panel ships messages for. */
export const SUPPORTED_LOCALES = ["en", "es"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

/** Locale used when the cookie is missing or holds anything else. */
export const DEFAULT_LOCALE: Locale = "en";

/** Name of the cookie that holds the chosen locale. */
export const LOCALE_COOKIE = "locale";

/** Whether a value is one of the {@link SUPPORTED_LOCALES}. */
export function isSupportedLocale(value: string | undefined): value is Locale {
	return SUPPORTED_LOCALES.includes(value as Locale);
}
