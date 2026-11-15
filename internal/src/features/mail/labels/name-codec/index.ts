import { isKeywordAtom, labelKey, MAX_KEYWORD_BYTES } from "../keyword-codec";

/**
 * Versioned, case-insensitive transport for exact names. Every UTF-8 byte is
 * hex, including ASCII letters: `A` and `a` remain distinct even when the mail
 * server compares keywords without regard to case. No Unicode normalization,
 * trimming or whitespace folding is performed. This is separate from the
 * legacy display codec until label editing is wired into the UI.
 */
const PREFIX = "ep1-";

/**
 * Maximum UTF-8 bytes of a name: 30, fitting the server's 64-byte keyword.
 * Reuse for HTML maxlength (via fieldLength), client and server validation.
 * HTML counts UTF-16 units; validateLabelName also checks UTF-8 bytes, so a
 * Unicode paste can fit the HTML bound and still need a validation error.
 */
export const LABEL_NAME_MAX = (MAX_KEYWORD_BYTES - PREFIX.length) / 2;

/** Shared client/server rule. Preserve every nonempty well-formed name exactly. */
export function validateLabelName(name: string): boolean {
	return (
		name.length > 0 &&
		name.length <= LABEL_NAME_MAX &&
		name.isWellFormed() &&
		new TextEncoder().encode(name).length <= LABEL_NAME_MAX
	);
}

/** Encode a name as an IMAP atom, or null when it exceeds the shared rule. */
export function encodeLabelName(name: string): string | null {
	if (!validateLabelName(name)) return null;
	return (
		PREFIX +
		[...new TextEncoder().encode(name)]
			.map((byte) => byte.toString(16).padStart(2, "0"))
			.join("")
	);
}

/**
 * Decode only complete, canonical encodings (hex case is immaterial to IMAP).
 * null identifies an external/raw keyword; keep its original bytes to remove
 * it. Fatal UTF-8 decoding rejects overlong sequences and surrogate encodings.
 * ignoreBOM preserves an initial U+FEFF rather than silently dropping it.
 */
export function decodeLabelKeyword(keyword: string): string | null {
	if (!isKeywordAtom(keyword) || !/^ep1-(?:[0-9a-f]{2})+$/i.test(keyword)) {
		return null;
	}
	const hex = keyword.slice(PREFIX.length);
	const bytes = Uint8Array.from(hex.match(/../g) ?? [], (pair) =>
		Number.parseInt(pair, 16),
	);
	try {
		const name = new TextDecoder("utf-8", {
			fatal: true,
			ignoreBOM: true,
		}).decode(bytes);
		return encodeLabelName(name) === labelKey(keyword) ? name : null;
	} catch {
		return null;
	}
}
