import "server-only";

import { DEFAULT_LOCALE, isSupportedLocale, type Locale } from "@/i18n/locales";

import { ConfigError } from "../config-error";

/**
 * Name of the variable that holds the language the panel shows when the
 * person chose none and the browser asked for none the panel ships.
 */
export const DEFAULT_LOCALE_VARIABLE = "EPISTLE_PANEL_DEFAULT_LOCALE";

/**
 * The language the operator chose, read from the default locale variable.
 *
 * Unset or empty leaves the panel's own English. A value that is not one of
 * the languages the panel ships is a mistake an operator must hear about: it
 * throws a `ConfigError` that names the variable and never the value, and the
 * start refuses to go on with it.
 */
export function readDefaultLocale(): Locale {
	const value = (process.env[DEFAULT_LOCALE_VARIABLE] ?? "").trim();
	if (value === "") {
		return DEFAULT_LOCALE;
	}
	if (!isSupportedLocale(value)) {
		throw new ConfigError(
			`${DEFAULT_LOCALE_VARIABLE} is set to a language the panel does not ship`,
		);
	}
	return value;
}

/**
 * The language the operator chose, or the panel's own English when the
 * variable is unset or cannot be used.
 *
 * The start is the gate: it refuses to go on with a value that does not parse,
 * so a server that kept running would only be a server whose environment
 * changed under it.
 */
export function defaultLocale(): Locale {
	try {
		return readDefaultLocale();
	} catch {
		return DEFAULT_LOCALE;
	}
}
