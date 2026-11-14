/**
 * A label is a keyword on the message. epistle keeps any keyword that is an
 * IMAP atom: plain ASCII with no space, no control and none of `( ) { % * " ]
 * \`, at most 64 bytes, and it matches one without regard to case. A label's
 * name is what a person typed, so it is written into that alphabet here and
 * read back out of it.
 *
 * A letter, a digit, a dot and a hyphen stand for themselves. Every other
 * byte of the name's UTF-8 form is `_` and two hexadecimal digits, the
 * underscore included, so the two directions are exact: `Work` stays `Work`,
 * `To do` is `To_20do`, `Año` is `A_C3_B1o`. A name made of plain letters
 * reads the same in any IMAP client.
 */

/** Longest keyword epistle keeps, in bytes: its `MAX_KEYWORD_BYTES`. */
export const MAX_KEYWORD_BYTES = 64;

/** Most keywords one message carries: epistle's `MAX_KEYWORDS_PER_MESSAGE`. */
export const MAX_KEYWORDS_PER_MESSAGE = 32;

const UNDERSCORE = 0x5f;

/** Bytes that stand for themselves: `A-Z`, `a-z`, `0-9`, `.` and `-`. */
function isPlain(byte: number): boolean {
	return (
		(byte >= 0x41 && byte <= 0x5a) ||
		(byte >= 0x61 && byte <= 0x7a) ||
		(byte >= 0x30 && byte <= 0x39) ||
		byte === 0x2e ||
		byte === 0x2d
	);
}

/**
 * What a name may not hold: a control, a line or paragraph separator, a
 * bidirectional control, a zero-width character or the byte-order mark. The
 * same things `safeLine` takes out of a line, refused here so a name is never
 * silently a different one. A tab is the exception: it is white space, and
 * reads as a space like any other.
 */
const char = (code: number) => String.fromCodePoint(code);
const FORBIDDEN = new RegExp(
	`(?!\\t)[\\p{Cc}\\p{Zl}\\p{Zp}${char(0x202a)}-${char(0x202e)}${char(0x2066)}-${char(0x2069)}${char(0x200b)}-${char(0x200f)}${char(0xfeff)}]`,
	"u",
);

/**
 * The name as it is kept: composed (NFC), runs of white space as one space,
 * no space at the ends. `null` when nothing is left or it holds a character a
 * name may not hold.
 */
export function normalizeLabelName(name: string): string | null {
	if (FORBIDDEN.test(name)) {
		return null;
	}
	const normal = name.normalize("NFC").replace(/\s+/gu, " ").trim();
	return normal === "" ? null : normal;
}

/** Keywords mail clients write without the `$` that marks a system keyword. */
const UNMARKED_SYSTEM = new Set(["junk", "nonjunk", "notjunk"]);

/**
 * Whether a keyword is a label. One that starts with `$` or `\` belongs to the
 * protocol (`$seen`, `$Important`, `$Forwarded`, `$label1`), and a few are
 * written by mail clients as their own bookkeeping; none of those is offered
 * or shown as a label.
 */
export function isLabelKeyword(keyword: string): boolean {
	return (
		keyword !== "" &&
		!keyword.startsWith("$") &&
		!keyword.startsWith("\\") &&
		!UNMARKED_SYSTEM.has(keyword.toLowerCase())
	);
}

/**
 * The keyword that carries a label of this name, or `null` when the name is
 * not one (see {@link normalizeLabelName}) or its keyword would pass the
 * server's length.
 */
export function labelToKeyword(name: string): string | null {
	const normal = normalizeLabelName(name);
	if (normal === null) {
		return null;
	}
	let keyword = "";
	for (const byte of new TextEncoder().encode(normal)) {
		keyword += isPlain(byte)
			? String.fromCharCode(byte)
			: `_${byte.toString(16).toUpperCase().padStart(2, "0")}`;
		if (keyword.length > MAX_KEYWORD_BYTES) {
			return null;
		}
	}
	if (!isLabelKeyword(keyword)) {
		// A name like "Junk" is a keyword mail clients keep for themselves.
		// Its first letter is written as digits, so the label is another
		// keyword, still reads back as the name, and is shown as a label.
		const first = keyword.charCodeAt(0).toString(16).toUpperCase();
		keyword = `_${first}${keyword.slice(1)}`;
	}
	return keyword.length > MAX_KEYWORD_BYTES ? null : keyword;
}

const HEX_PAIR = /^[0-9A-Fa-f]{2}$/;

/** The bytes a keyword written by {@link labelToKeyword} stands for, or `null` when it was not written by it. */
function decodeBytes(keyword: string): Uint8Array | null {
	const bytes: number[] = [];
	for (let index = 0; index < keyword.length; index += 1) {
		const code = keyword.charCodeAt(index);
		if (code === UNDERSCORE) {
			const pair = keyword.slice(index + 1, index + 3);
			if (!HEX_PAIR.test(pair)) {
				return null;
			}
			bytes.push(Number.parseInt(pair, 16));
			index += 2;
		} else if (isPlain(code)) {
			bytes.push(code);
		} else {
			return null;
		}
	}
	return Uint8Array.from(bytes);
}

/**
 * The name a keyword shows as. A keyword this module wrote reads back as the
 * name it was made from. Any other keyword (one an IMAP client set, with a
 * character that is not written this way, an escape that is not UTF-8, or one
 * that would read as a control or a bidirectional override) is shown as it
 * is, so it can still be seen and taken off. So is one that reads as a name
 * but is not how that name is written (`_41bc` beside `Abc`): two keywords
 * never show as one name.
 */
export function keywordToLabel(keyword: string): string {
	const bytes = decodeBytes(keyword);
	if (bytes === null) {
		return keyword;
	}
	let name: string;
	try {
		// `ignoreBOM` keeps a leading byte-order mark in the text, where the
		// check below refuses it; without it the decoder drops the mark and
		// two keywords would read as one name.
		name = new TextDecoder("utf-8", {
			fatal: true,
			ignoreBOM: true,
		}).decode(bytes);
	} catch {
		return keyword;
	}
	return labelToKeyword(name)?.toLowerCase() === keyword.toLowerCase()
		? name
		: keyword;
}

/** What makes two keywords the same label: the server matches a keyword without regard to case. */
export function labelKey(keyword: string): string {
	return keyword.toLowerCase();
}
