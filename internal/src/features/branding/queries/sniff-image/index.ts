/** Image types the brand routes serve, by what the bytes are, not by the file name. */
export type ImageType =
	| "image/png"
	| "image/jpeg"
	| "image/webp"
	| "image/x-icon"
	| "image/svg+xml";

const startsWith = (bytes: Uint8Array, magic: readonly number[]) =>
	magic.every((byte, index) => bytes[index] === byte);

/**
 * True when the text, after optional whitespace, an XML prolog and comments,
 * opens an `<svg` element. A linear scan: a single regular expression for this
 * backtracks exponentially on input such as many `<!--` with no `-->`.
 */
function opensSvgElement(text: string): boolean {
	let at = 0;
	const skipSpace = () => {
		while (at < text.length && /\s/.test(text.charAt(at))) {
			at += 1;
		}
	};
	skipSpace();
	if (text.startsWith("<?xml", at)) {
		const end = text.indexOf("?>", at);
		if (end === -1) {
			return false;
		}
		at = end + 2;
		skipSpace();
	}
	while (text.startsWith("<!--", at)) {
		const end = text.indexOf("-->", at + 4);
		if (end === -1) {
			return false;
		}
		at = end + 3;
		skipSpace();
	}
	return (
		text.slice(at, at + 4).toLowerCase() === "<svg" &&
		/[\s>]/.test(text.charAt(at + 4))
	);
}

/**
 * Replace numeric character references (`&#106;`, `&#x6a;`) by the character
 * they stand for, as an XML parser would, so a marker written with them cannot
 * slip past the filter. One linear pass: each reference is read at most
 * `MAX_REFERENCE` characters ahead, never rescanned.
 */
const MAX_REFERENCE = 10;

function decodeNumericReferences(text: string): string {
	let out = "";
	let from = 0;
	let at = text.indexOf("&#", from);
	while (at !== -1) {
		out += text.slice(from, at);
		const end = text.indexOf(";", at + 2);
		const body =
			end !== -1 && end - at <= MAX_REFERENCE
				? text.slice(at + 2, end)
				: "";
		const hex = body.startsWith("x") || body.startsWith("X");
		const digits = hex ? body.slice(1) : body;
		const valid = hex ? /^[0-9a-fA-F]+$/ : /^[0-9]+$/;
		const code = valid.test(digits)
			? Number.parseInt(digits, hex ? 16 : 10)
			: -1;
		if (code >= 0 && code <= 0x10ffff) {
			out += String.fromCodePoint(code);
			from = end + 1;
		} else {
			out += "&#";
			from = at + 2;
		}
		at = text.indexOf("&#", from);
	}
	return out + text.slice(from);
}

/** The text without ASCII control characters and spaces (code points up to U+0020, and U+007F to U+009F). */
function dropControlCharacters(text: string): string {
	let out = "";
	for (const char of text) {
		const code = char.codePointAt(0) ?? 0;
		if (code > 0x20 && (code < 0x7f || code > 0x9f)) {
			out += char;
		}
	}
	return out;
}

/** True when the SVG text can run script or embed HTML. */
function carriesActiveContent(raw: string): boolean {
	const text = decodeNumericReferences(raw);
	if (/<script|\son[a-z]+\s*=|<foreignObject/i.test(text)) {
		return true;
	}
	// A URL parser ignores tabs, newlines and other control characters, so
	// `java&#9;script:` is still `javascript:`.
	return /javascript:/i.test(dropControlCharacters(text));
}

/**
 * Recognise an image from its first bytes. An SVG is accepted only when it is
 * text that opens an `<svg` element and holds no `<script`, `javascript:` or
 * event-handler attribute, whether written literally or with numeric character
 * references; the route also serves it under a sandboxing CSP, so this is a
 * second guard. Returns `undefined` for anything else.
 */
export function sniffImage(bytes: Uint8Array): ImageType | undefined {
	if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
		return "image/png";
	}
	if (startsWith(bytes, [0xff, 0xd8, 0xff])) {
		return "image/jpeg";
	}
	if (startsWith(bytes, [0x00, 0x00, 0x01, 0x00])) {
		return "image/x-icon";
	}
	if (
		startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
		bytes[8] === 0x57 &&
		bytes[9] === 0x45 &&
		bytes[10] === 0x42 &&
		bytes[11] === 0x50
	) {
		return "image/webp";
	}
	let text: string;
	try {
		text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
	} catch {
		return undefined;
	}
	if (!opensSvgElement(text)) {
		return undefined;
	}
	if (carriesActiveContent(text)) {
		return undefined;
	}
	return "image/svg+xml";
}
