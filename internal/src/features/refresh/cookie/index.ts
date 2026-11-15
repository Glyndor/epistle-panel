import {
	REFRESH_COOKIE,
	REFRESH_COOKIE_PATH,
	type RefreshPace,
} from "@/features/refresh/config/pace";
import {
	type CookieWriter,
	preferenceCookieOptions,
} from "@/lib/preference-cookie";

export function writeRefreshCookie(
	store: CookieWriter,
	pace: RefreshPace,
): void {
	store.set(
		REFRESH_COOKIE,
		pace,
		preferenceCookieOptions({
			httpOnly: true,
			path: REFRESH_COOKIE_PATH,
		}),
	);
}
