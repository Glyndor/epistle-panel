import {
	TIME_ZONE_COOKIE,
	TIME_ZONE_COOKIE_PATH,
	type TimeZone,
} from "@/features/time-zone/config/zones";
import {
	type CookieWriter,
	preferenceCookieOptions,
} from "@/lib/preference-cookie";

/**
 * Remember the chosen time zone in the `time-zone` cookie. The caller has
 * already checked the session and the value. The pages that print a date read
 * it back on the next request, so a reload shows the same clock.
 *
 * `HttpOnly`: only the server reads it, and the controls learn the choice from
 * the page the server rendered. It holds the name of a zone and no secret. It
 * is sent under `/app`, so the mail area and the preferences page both see it.
 */
export function writeTimeZoneCookie(
	store: CookieWriter,
	timeZone: TimeZone,
): void {
	store.set(
		TIME_ZONE_COOKIE,
		timeZone,
		preferenceCookieOptions({
			httpOnly: true,
			path: TIME_ZONE_COOKIE_PATH,
		}),
	);
}
