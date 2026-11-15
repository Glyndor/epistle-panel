import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";

import { DEFAULT_LOCALE, LOCALE_COOKIE } from "@/i18n/locales";
import { loadMessages } from "@/i18n/messages";
import { resolveLocale } from "@/i18n/resolve";
import { defaultLocale } from "@/lib/config/default-locale";

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
	// The person's own choice first, then what the browser asked for, then the
	// operator's default, then English.
	const cookieLocale = (await cookies()).get(LOCALE_COOKIE)?.value;
	const acceptLanguage =
		(await headers()).get("accept-language") ?? undefined;
	const locale = resolveLocale(cookieLocale, acceptLanguage, defaultLocale());
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
