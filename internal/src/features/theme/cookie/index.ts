import {
	THEME_COOKIE,
	type ThemeChoice,
} from "@/features/theme/config/choices";
import {
	type CookieWriter,
	preferenceCookieOptions,
} from "@/lib/preference-cookie";

/**
 * Remember the chosen theme in the `theme` cookie. The caller has already
 * checked the session and the value. The root layout reads it on the next
 * request and paints the choice on `<html>`, so a reload shows no other theme
 * first.
 *
 * The cookie is not `HttpOnly`: it holds one of three public words, and the
 * page that replaces the whole document after a failure of the root layout
 * (`app/global-error`) can only learn the choice in the browser.
 */
export function writeThemeCookie(
	store: CookieWriter,
	choice: ThemeChoice,
): void {
	store.set(
		THEME_COOKIE,
		choice,
		preferenceCookieOptions({ httpOnly: false, path: "/" }),
	);
}
