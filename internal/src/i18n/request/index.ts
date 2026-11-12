import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";

import { loadMessages } from "@/i18n/messages";

export const SUPPORTED_LOCALES = ["en", "es"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

const DEFAULT_LOCALE: Locale = "en";

function isSupported(value: string | undefined): value is Locale {
	return SUPPORTED_LOCALES.includes(value as Locale);
}

/** Resolve a dot-namespaced key against the English source messages. */
function englishMessage(catalog: unknown, key: string): string | undefined {
	let node: unknown = catalog;
	for (const segment of key.split(".")) {
		if (typeof node !== "object" || node === null) {
			return undefined;
		}
		node = (node as Record<string, unknown>)[segment];
	}
	return typeof node === "string" ? node : undefined;
}

export default getRequestConfig(async () => {
	const cookieLocale = (await cookies()).get("locale")?.value;
	const locale = isSupported(cookieLocale) ? cookieLocale : DEFAULT_LOCALE;
	const english = await loadMessages(DEFAULT_LOCALE);

	return {
		locale,
		messages:
			locale === DEFAULT_LOCALE ? english : await loadMessages(locale),
		// A key missing from the active locale falls back to the English source
		// string, never the raw dotted key path, so a not-yet-translated `es`
		// string degrades to readable English instead of leaking `queue.next`.
		getMessageFallback: ({ key }) => englishMessage(english, key) ?? key,
		// The fallback already handled the miss; swallow the error so a gap does
		// not spam the server logs on every render.
		onError: () => {},
	};
});
