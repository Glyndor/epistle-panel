import {
	LIST_DENSITY_COOKIE,
	LIST_DENSITY_COOKIE_PATH,
	type ListDensity,
} from "@/features/mail/config/list-density";
import {
	type CookieWriter,
	preferenceCookieOptions,
} from "@/lib/preference-cookie";

/**
 * Remember the density of the message list in the `list-density` cookie. The
 * caller has already checked the session and the value. The list pane reads
 * it on the next request and paints the choice with the first frame.
 *
 * `HttpOnly`: only the server reads it, and the controls learn the choice from
 * the page the server rendered. It holds one of two public words and no
 * secret. It is sent under `/app`, so the mail area and the preferences page
 * both see it.
 */
export function writeListDensityCookie(
	store: CookieWriter,
	density: ListDensity,
): void {
	store.set(
		LIST_DENSITY_COOKIE,
		density,
		preferenceCookieOptions({
			httpOnly: true,
			path: LIST_DENSITY_COOKIE_PATH,
		}),
	);
}
