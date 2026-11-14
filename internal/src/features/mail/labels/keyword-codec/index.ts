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
 *
 * A keyword that was not written this way (one an IMAP client set) shows as
 * the keyword itself, and a name typed like one is that keyword. Two keywords
 * never show as one name: that is checked in both directions.
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

const char = (code: number) => String.fromCodePoint(code);
const ZWNJ = char(0x200c);
const ZWJ = char(0x200d);
/** The selector that asks for the emoji form of the character before it. */
const EMOJI_FORM = char(0xfe0f);

/**
 * What a name may not hold, because it cannot be seen or changes what is
 * around it: a control (a tab is white space and reads as a space), a line or
 * paragraph separator, half of a surrogate pair, any format character (the
 * bidirectional controls and marks, the zero-width ones, the soft hyphen, the
 * byte-order mark, the tag characters), a filler that draws as nothing, and a
 * variation selector. The two joiners and the emoji selector are format too,
 * and are let through only where {@link MISPLACED} does not find them.
 */
const FORBIDDEN = new RegExp(
	[
		"(?!\\t)[\\p{Cc}\\p{Zl}\\p{Zp}\\p{Cs}]",
		`(?![${ZWNJ}${ZWJ}])\\p{Cf}`,
		`[${char(0x034f)}${char(0x115f)}${char(0x1160)}${char(0x180b)}-${char(0x180f)}${char(0x2800)}${char(0x3164)}${char(0xffa0)}]`,
		`[${char(0xfe00)}-${char(0xfe0e)}${char(0xe0100)}-${char(0xe01ef)}]`,
	].join("|"),
	"u",
);

/**
 * A joiner or the emoji selector where it joins or selects nothing: first,
 * after white space or after another of them, or (a joiner) last or before
 * white space. Between two characters they are part of how a word or an emoji
 * is written (Persian, Indic scripts, emoji sequences); anywhere else they
 * are only invisible.
 */
const MISPLACED = new RegExp(
	[
		`(?:^|\\s|[${ZWNJ}${ZWJ}])[${ZWNJ}${ZWJ}]`,
		`[${ZWNJ}${ZWJ}](?:$|\\s|${EMOJI_FORM})`,
		`(?:^|\\s|[${ZWNJ}${ZWJ}${EMOJI_FORM}])${EMOJI_FORM}`,
	].join("|"),
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
	return normal === "" || MISPLACED.test(normal) ? null : normal;
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

/** Whether the server would keep `token` as a keyword: its `imap::keyword::validate`. */
export function isKeywordAtom(token: string): boolean {
	return (
		token.length >= 1 &&
		token.length <= MAX_KEYWORD_BYTES &&
		/^[\x21-\x7e]+$/.test(token) &&
		!/[(){%*"\]\\]/.test(token)
	);
}

/**
 * A name written out byte by byte, with nothing decided yet about whether it
 * is the keyword the name gets. `null` when it would pass the server's length.
 */
function escaped(normal: string): string | null {
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

/** The bytes a keyword written by {@link escaped} stands for, or `null` when it was not written by it. */
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
 * Whether a name is itself a keyword that shows as that name: `Work_items`,
 * `a+b`, anything an IMAP client could have set that does not read as
 * something else. Such a name needs no writing out, and the written-out form
 * of it is a different keyword that must not show under the same name.
 */
function isOwnKeyword(name: string): boolean {
	return (
		isKeywordAtom(name) &&
		isLabelKeyword(name) &&
		keywordToLabel(name) === name
	);
}

/**
 * The name a keyword shows as. A keyword written from a name reads back as
 * that name. Any other keyword is shown as it is, so it can still be seen and
 * taken off: one with a character that is not written this way, digits that
 * are not UTF-8, one that would read as a control, an invisible character or
 * a text-direction control, one that reads as a name written another way
 * (`_41bc` beside `Abc`), and one that reads as a name which is a keyword of
 * its own (`foo_5Fbar` beside `foo_bar`).
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
	if (name === keyword) {
		// Nothing was written as digits: the keyword is its own name.
		return keyword;
	}
	if (
		normalizeLabelName(name) !== name ||
		escaped(name)?.toLowerCase() !== keyword.toLowerCase() ||
		// The name is shorter than the keyword that held digits, so this ends.
		isOwnKeyword(name)
	) {
		return keyword;
	}
	return name;
}

/**
 * The keyword that carries a label of this name, or `null` when the name is
 * not one (see {@link normalizeLabelName}) or its keyword would pass the
 * server's length. A name that is already a keyword showing as itself is that
 * keyword; any other is written out.
 */
export function labelToKeyword(name: string): string | null {
	const normal = normalizeLabelName(name);
	if (normal === null) {
		return null;
	}
	return isOwnKeyword(normal) ? normal : escaped(normal);
}

/** What makes two keywords the same label: the server matches a keyword without regard to case. */
export function labelKey(keyword: string): string {
	return keyword.toLowerCase();
}
