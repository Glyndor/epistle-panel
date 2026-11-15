import { DEFAULT_LOCALE, isSupportedLocale, type Locale } from "@/i18n/locales";

/**
 * Longest `Accept-Language` header read, in characters. A browser asks for a
 * handful of languages; a header this long is not one, and reading all of it
 * would let a client make the server work.
 */
const MAX_HEADER_LENGTH = 4_096;

/** Most languages read out of one header. */
const MAX_ENTRIES = 64;

/** A quality value the panel reads: `0`, `0.5`, `0.85`, `1`. */
const QUALITY = /^(?:0(?:\.\d{1,3})?|1(?:\.0{1,3})?)$/;

interface Wanted {
	/** The language range, in lower case. */
	range: string;
	/** How much the browser wants it, from `0` to `1`. */
	quality: number;
	/** The place it had in the header, to break a tie. */
	order: number;
}

/**
 * The quality of one language range, or `undefined` when it carries a value
 * the panel cannot read. A range with no `q` is wanted at full weight; a
 * range with a malformed one is not wanted at all, since a value nobody can
 * read says nothing about what the browser prefers.
 */
function readQuality(segments: string[]): number | undefined {
	let quality = 1;
	let seen = false;
	for (const segment of segments.slice(1)) {
		const [name, ...rest] = segment.split("=");
		if (name?.trim().toLowerCase() !== "q") {
			continue;
		}
		const value = rest.join("=").trim();
		if (seen || !QUALITY.test(value)) {
			return undefined;
		}
		seen = true;
		quality = Number.parseFloat(value);
	}
	return quality;
}

/**
 * The language of one range, among the ones the panel ships.
 *
 * A range names a language and, sometimes, a region: `fr-CH` is French, and
 * the panel ships French, so the region is dropped and the language is
 * answered. A wildcard asks for anything, which says nothing about a
 * language, so it is answered with nothing.
 */
function matchLocale(range: string): Locale | undefined {
	if (!/^[a-z]{1,8}(?:-[a-z0-9]{1,8})*$/.test(range)) {
		return undefined;
	}
	if (isSupportedLocale(range)) {
		return range;
	}
	const primary = range.split("-")[0] ?? "";
	return isSupportedLocale(primary) ? primary : undefined;
}

/**
 * The language the browser asked for, among the ones the panel ships.
 *
 * The ranges are read in the order the browser wrote them, and the one it
 * wants most comes first: a range with a higher quality wins, and a tie goes
 * to the range written first. The header is read up to its length and its
 * number of ranges are capped, so a hostile one costs the server no more than
 * an ordinary one.
 */
export function localeFromAcceptLanguage(
	header: string | undefined,
): Locale | undefined {
	if (!header) {
		return undefined;
	}
	let text = header.slice(0, MAX_HEADER_LENGTH);
	if (header.length > MAX_HEADER_LENGTH) {
		// Never interpret a partly read range or q value as a complete one.
		text = text.slice(0, Math.max(0, text.lastIndexOf(",")));
	}
	const wanted: Wanted[] = [];
	let order = 0;
	for (const part of text.split(",", MAX_ENTRIES)) {
		const segments = part.split(";");
		const range = (segments[0] ?? "").trim().toLowerCase();
		if (range === "") {
			continue;
		}
		const quality = readQuality(segments);
		if (quality === undefined || quality <= 0) {
			continue;
		}
		wanted.push({ range, quality, order: order++ });
	}
	wanted.sort((a, b) => b.quality - a.quality || a.order - b.order);
	for (const candidate of wanted) {
		const locale = matchLocale(candidate.range);
		if (locale) {
			return locale;
		}
	}
	return undefined;
}

/**
 * The language of a request.
 *
 * The person's own choice comes first: the cookie holds the language they
 * picked in the menu, and it is checked against the languages the panel ships
 * before it is believed. Then what the browser asked for, then the operator's
 * default, and English when there is none of them.
 */
export function resolveLocale(
	cookieValue: string | undefined,
	acceptLanguage: string | undefined,
	operatorDefault: Locale | undefined,
): Locale {
	if (isSupportedLocale(cookieValue)) {
		return cookieValue;
	}
	return (
		localeFromAcceptLanguage(acceptLanguage) ??
		operatorDefault ??
		DEFAULT_LOCALE
	);
}
