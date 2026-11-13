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

/** Longest single-line value shown, in UTF-16 code units. */
export const MAX_LINE_LENGTH = 998;

/** Take the bidirectional controls out of `value`. */
export function stripBidi(value: string): string {
	return value.replace(BIDI_CONTROLS, "");
}

/**
 * A value for one line of the interface: bidi controls removed, every control
 * or separator turned into a space, runs of white space collapsed, the ends
 * trimmed and the length capped at `max`.
 */
export function safeLine(value: string, max = MAX_LINE_LENGTH): string {
	const cleaned = stripBidi(value)
		.replace(LINE_BREAKERS, " ")
		.replace(/\s+/gu, " ")
		.trim();
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
