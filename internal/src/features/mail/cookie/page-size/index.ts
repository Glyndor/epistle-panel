import {
	PAGE_SIZE_COOKIE,
	PAGE_SIZE_COOKIE_PATH,
	type PageSizeChoice,
} from "@/features/mail/config/page-size";
import {
	type CookieWriter,
	preferenceCookieOptions,
} from "@/lib/preference-cookie";

export function writePageSizeCookie(
	store: CookieWriter,
	choice: PageSizeChoice,
): void {
	store.set(
		PAGE_SIZE_COOKIE,
		choice,
		preferenceCookieOptions({
			httpOnly: true,
			path: PAGE_SIZE_COOKIE_PATH,
		}),
	);
}
