/**
 * How the panel keeps what a person prefers (language, theme, the density of
 * the message list, remote images): a cookie of its own for each, that lives a
 * year, is sent over HTTPS only and is not sent along with a request from
 * another site. This
 * is the one place those attributes are written, so the controls that change
 * a preference (the theme button, the density toggle, the preferences page)
 * cannot drift apart. What differs per preference, whether a script may read
 * it and where it is sent, is passed in.
 */
export const PREFERENCE_COOKIE_MAX_AGE_SECONDS = 365 * 24 * 60 * 60;

/** The part of the framework's cookie store a preference is written through. */
export interface CookieWriter {
	set(name: string, value: string, options: PreferenceCookieOptions): unknown;
}

export interface PreferenceCookieOptions {
	httpOnly: boolean;
	secure: true;
	sameSite: "lax";
	path: string;
	maxAge: number;
}

/** The attributes of a preference cookie. */
export function preferenceCookieOptions({
	httpOnly,
	path,
}: {
	httpOnly: boolean;
	path: string;
}): PreferenceCookieOptions {
	return {
		httpOnly,
		secure: true,
		sameSite: "lax",
		path,
		maxAge: PREFERENCE_COOKIE_MAX_AGE_SECONDS,
	};
}
