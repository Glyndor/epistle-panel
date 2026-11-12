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
 * Recognise an image from its first bytes. An SVG is accepted only when it is
 * text that opens an `<svg` element and holds no `<script`, `javascript:` or
 * event-handler attribute; the route also serves it under a sandboxing CSP, so
 * this is a second guard. Returns `undefined` for anything else.
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
	if (!/^\s*(<\?xml[^>]*\?>\s*)?(<!--[\s\S]*?-->\s*)*<svg[\s>]/i.test(text)) {
		return undefined;
	}
	if (/<script|javascript:|\son[a-z]+\s*=|<foreignObject/i.test(text)) {
		return undefined;
	}
	return "image/svg+xml";
}
