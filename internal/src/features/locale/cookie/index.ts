import { LOCALE_COOKIE, type Locale } from "@/i18n/locales";
import {
	type CookieWriter,
	preferenceCookieOptions,
} from "@/lib/preference-cookie";

/**
 * Remember the interface language in the `locale` cookie. The caller has
 * already checked the session and the value; the request's language resolver
 * (`i18n/request`) reads it back and believes it only if it is a shipped code.
 * `HttpOnly`: only the server reads it.
 */
export function writeLocaleCookie(store: CookieWriter, locale: Locale): void {
	store.set(
		LOCALE_COOKIE,
		locale,
		preferenceCookieOptions({ httpOnly: true, path: "/" }),
	);
}
