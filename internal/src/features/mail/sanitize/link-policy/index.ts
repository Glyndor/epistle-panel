/** Schemes a link in a message may keep. Everything else, `javascript:` and `data:` first, loses its target. */
const LINK_SCHEMES = new Set(["http:", "https:", "mailto:", "tel:"]);

/** Longest link target kept, in characters. */
export const MAX_URL_LENGTH = 2048;

/** White space and controls, which base64 data in an attribute may contain and a decoder skips. */
const WHITE_SPACE = /[\p{Cc}\p{Zs}]/gu;

/**
 * The link target to keep for `raw`, or `null` when it must be dropped.
 *
 * The URL parser drops the tabs, line feeds and edge spaces a browser would
 * ignore in a scheme (`java\tscript:`) before it reads the scheme, so what is
 * checked is what a browser would act on; the result is the parsed and
 * re-serialised URL, never the raw text. A relative link has no scheme to
 * trust and is dropped, as is an `http` link that carries a user name or a
 * password (`https://bank.example@evil.example`, a way to dress up the host).
 */
export function safeHref(raw: string): string | null {
	if (raw.trim() === "" || raw.length > MAX_URL_LENGTH) {
		return null;
	}
	let url: URL;
	try {
		url = new URL(raw);
	} catch {
		return null;
	}
	if (!LINK_SCHEMES.has(url.protocol)) {
		return null;
	}
	if (url.username !== "" || url.password !== "") {
		return null;
	}
	return url.href;
}

/** The image targets that may load once the reader asked for remote images: `http` and `https` only. */
export function safeRemoteImage(raw: string): string | null {
	const href = safeHref(raw);
	if (href === null) {
		return null;
	}
	return href.startsWith("http:") || href.startsWith("https:") ? href : null;
}

/** An inline image: base64 raster data of a type that cannot carry script (never SVG). */
const DATA_IMAGE =
	/^data:image\/(?:png|jpe?g|gif|webp);base64,[A-Za-z0-9+/]+={0,2}$/u;

/** Largest inline image kept, in characters of the URL. */
export const MAX_DATA_IMAGE_LENGTH = 1_500_000;

/** `raw` when it is a raster `data:` image within the cap, else `null`. */
export function safeDataImage(raw: string): string | null {
	const compact = raw.replace(WHITE_SPACE, "");
	return compact.length <= MAX_DATA_IMAGE_LENGTH && DATA_IMAGE.test(compact)
		? compact
		: null;
}
