"use client";

import { useEffect, useState } from "react";

import { ErrorNotice } from "@/components/error-notice";
import en from "@/i18n/messages/en/error.json";
import es from "@/i18n/messages/es/error.json";

import "./globals.css";

const CATALOGS = { en, es } as const;
type GlobalLocale = keyof typeof CATALOGS;

/** The locale the visitor chose, from the same cookie the server reads. */
function cookieLocale(cookie: string): GlobalLocale {
	const match = /(?:^|;\s*)locale=([^;]*)/.exec(cookie);
	return match?.[1] === "es" ? "es" : "en";
}

/**
 * Page for an error the root layout itself throws, which no `error.tsx` can
 * catch. It replaces the whole document, so it brings its own `<html>` and
 * `<body>` and cannot use the translation provider, which lives in the layout:
 * it loads the two small catalogs directly and starts in English, then
 * switches to the visitor's locale once it runs in the browser, so the server
 * render and the first client render agree. It uses classes only, since
 * `style-src 'self'` refuses inline styles.
 */
export default function GlobalError({
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	const [locale, setLocale] = useState<GlobalLocale>("en");
	useEffect(() => {
		setLocale(cookieLocale(document.cookie));
	}, []);

	return (
		<html lang={locale} className="h-full antialiased">
			<body className="flex min-h-full flex-col">
				<ErrorNotice labels={CATALOGS[locale]} onRetry={reset} />
			</body>
		</html>
	);
}
