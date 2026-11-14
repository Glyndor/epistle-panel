/**
 * Text that came from a message (a subject, a display name, a file name, a
 * header) is untrusted. It is always rendered as text, never as markup, and
 * these helpers take out what text can still do to a reader: reorder what is
 * around it (the bidirectional overrides, embeddings and isolates), hide
 * itself (zero-width and byte-order marks) or break the line it sits on
 * (controls, line and paragraph separators).
 */

const char = (code: number) => String.fromCodePoint(code);

/** Bidirectional overrides, embeddings and isolates: U+202A to U+202E and U+2066 to U+2069. */
const BIDI_CONTROLS = new RegExp(
	`[${char(0x202a)}-${char(0x202e)}${char(0x2066)}-${char(0x2069)}]`,
	"gu",
);

/** Controls (C0, DEL, C1), the line and paragraph separators and the byte-order mark. */
const LINE_BREAKERS = new RegExp(
	`[\\p{Cc}\\p{Zl}\\p{Zp}${char(0xfeff)}]`,
	"gu",
);

/** Same set as {@link LINE_BREAKERS} but a tab and a line feed survive, for a body shown as text. */
const CONTROLS_EXCEPT_BREAKS = new RegExp(
	`(?![\\t\\n])[\\p{Cc}\\p{Zl}\\p{Zp}${char(0xfeff)}]`,
	"gu",
);

/**
 * Characters that draw nothing and are part of no word: the zero-width space,
 * the word joiner and the invisible operators, the Mongolian vowel separator,
 * the Hangul fillers and the interlinear annotation marks. The two joiners
 * (Persian and Indic scripts, emoji sequences), the direction marks, the soft
 * hyphen, the variation selectors and the tag characters of a flag are left:
 * they are how some text is written.
 */
const DRAWS_NOTHING = new RegExp(
	`[${char(0x200b)}${char(0x2060)}-${char(0x2064)}${char(0x180e)}${char(0x115f)}${char(0x1160)}${char(0x3164)}${char(0xffa0)}${char(0xfff9)}-${char(0xfffb)}]`,
	"gu",
);

/** A value with nothing in it to see: only format characters, white space and variation selectors. */
const NOTHING_TO_SEE = new RegExp(
	`^[\\p{Cf}\\p{Z}${char(0xfe00)}-${char(0xfe0f)}${char(0xe0100)}-${char(0xe01ef)}]*$`,
	"u",
);

/** Longest single-line value shown, in UTF-16 code units. */
export const MAX_LINE_LENGTH = 998;

/** Take the bidirectional controls out of `value`. */
export function stripBidi(value: string): string {
	return value.replace(BIDI_CONTROLS, "");
}

/**
 * A value for one line of the interface: bidi controls and characters that
 * draw nothing removed, every control or separator turned into a space, runs
 * of white space collapsed, the ends trimmed and the length capped at `max`.
 * A value with nothing left to see is empty, so whoever shows it falls back to
 * what it shows for none (a sender with no name, a message with no subject)
 * instead of a blank that looks like a fault.
 */
export function safeLine(value: string, max = MAX_LINE_LENGTH): string {
	const cleaned = stripBidi(value)
		.replace(DRAWS_NOTHING, "")
		.replace(LINE_BREAKERS, " ")
		.replace(/\s+/gu, " ")
		.trim();
	if (NOTHING_TO_SEE.test(cleaned)) {
		return "";
	}
	return cleaned.length > max ? `${cleaned.slice(0, max)}…` : cleaned;
}

/**
 * A body shown as plain text: bidi controls and invisible controls removed,
 * the line breaks and tabs kept, `\r\n` and lone `\r` read as `\n`.
 */
export function safeBody(value: string): string {
	return stripBidi(value)
		.replace(/\r\n?/gu, "\n")
		.replace(CONTROLS_EXCEPT_BREAKS, "");
}
