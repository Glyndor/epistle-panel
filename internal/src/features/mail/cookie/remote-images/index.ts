import {
	REMOTE_IMAGES_COOKIE,
	REMOTE_IMAGES_COOKIE_PATH,
	type RemoteImageMode,
} from "@/features/mail/config/remote-images";
import {
	type CookieWriter,
	preferenceCookieOptions,
} from "@/lib/preference-cookie";

export function writeRemoteImagesCookie(
	store: CookieWriter,
	mode: RemoteImageMode,
): void {
	store.set(
		REMOTE_IMAGES_COOKIE,
		mode,
		preferenceCookieOptions({
			httpOnly: true,
			path: REMOTE_IMAGES_COOKIE_PATH,
		}),
	);
}
