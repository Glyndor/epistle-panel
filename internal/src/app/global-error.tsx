"use client";

import { useEffect, useState } from "react";

import { ErrorNotice } from "@/components/error-notice";
import {
	type ForcedTheme,
	forcedTheme,
	parseThemeChoice,
	THEME_COOKIE,
} from "@/features/theme/config/choices";
import { DEFAULT_LOCALE, isSupportedLocale, type Locale } from "@/i18n/locales";
import de from "@/i18n/messages/de/error.json";
import en from "@/i18n/messages/en/error.json";
import es from "@/i18n/messages/es/error.json";
import fr from "@/i18n/messages/fr/error.json";
import it from "@/i18n/messages/it/error.json";
import pt from "@/i18n/messages/pt/error.json";

import "./globals.css";

/** Typed on `Locale`, so shipping a locale without adding it here fails to compile. */
const CATALOGS: Record<Locale, typeof en> = { en, es, pt, fr, de, it };

/** The locale the visitor chose, from the same cookie the server reads. */
function cookieLocale(cookie: string): Locale {
	const value = /(?:^|;\s*)locale=([^;]*)/.exec(cookie)?.[1];
	return isSupportedLocale(value) ? value : DEFAULT_LOCALE;
}

/**
 * The theme the visitor chose, from the same cookie the server reads; nothing
 * for `system` or for a value that is not a choice.
 */
function cookieTheme(cookie: string): ForcedTheme | undefined {
	const value = new RegExp(`(?:^|;\\s*)${THEME_COOKIE}=([^;]*)`).exec(
		cookie,
	)?.[1];
	return forcedTheme(parseThemeChoice(value));
}

/**
 * Page for an error the root layout itself throws, which no `error.tsx` can
 * catch. It replaces the whole document, so it brings its own `<html>` and
 * `<body>` and cannot use the translation provider, which lives in the layout:
 * it loads the small `error` catalogs directly and starts in English, then
 * switches to the visitor's locale once it runs in the browser, so the server
 * render and the first client render agree. The chosen theme arrives the same
 * way, one frame late: until then the page follows `prefers-color-scheme`. It
 * uses classes only, since `style-src 'self'` refuses inline styles.
 */
export default function GlobalError({
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	const [locale, setLocale] = useState<Locale>("en");
	const [theme, setTheme] = useState<ForcedTheme>();
	useEffect(() => {
		setLocale(cookieLocale(document.cookie));
		setTheme(cookieTheme(document.cookie));
	}, []);

	return (
		<html lang={locale} data-theme={theme} className="h-full antialiased">
			<body className="flex min-h-full flex-col">
				<ErrorNotice labels={CATALOGS[locale]} onRetry={reset} />
			</body>
		</html>
	);
}
