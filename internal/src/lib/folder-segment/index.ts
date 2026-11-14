/**
 * A folder in a path. A folder's id is its name, the account's free text: it
 * can hold a slash (`Work/Q4`), a space, any script. Percent-encoding would
 * carry it, but what a `%2F` inside one segment means is decided again by the
 * framework, by a proxy in front and by the browser, and they need not agree.
 * So the name is written with an escape of its own that needs none of them:
 * a letter, a digit and a hyphen stand for themselves, a dot too except as the
 * first character (`.` and `..` are not segments), and every other byte of the
 * name's UTF-8 form is `_` and two upper-case hexadecimal digits.
 * `Work/Q4` is `Work_2FQ4`.
 */

const UNDERSCORE = 0x5f;
const DOT = 0x2e;

/** Bytes that stand for themselves anywhere: `A-Z`, `a-z`, `0-9` and `-`. */
function isPlain(byte: number): boolean {
	return (
		(byte >= 0x41 && byte <= 0x5a) ||
		(byte >= 0x61 && byte <= 0x7a) ||
		(byte >= 0x30 && byte <= 0x39) ||
		byte === 0x2d
	);
}

/** The path segment that names the folder `id`. Never empty for a name that is not. */
export function folderToSegment(id: string): string {
	let segment = "";
	new TextEncoder().encode(id).forEach((byte, index) => {
		segment +=
			isPlain(byte) || (byte === DOT && index > 0)
				? String.fromCharCode(byte)
				: `_${byte.toString(16).toUpperCase().padStart(2, "0")}`;
	});
	return segment;
}

const HEX_PAIR = /^[0-9A-F]{2}$/;

/**
 * The folder a segment names, or `null` when it is not one
 * {@link folderToSegment} writes. Only the one spelling is read, so a folder
 * has one path: digits in lower case, a byte written as digits that stands for
 * itself, or digits that are not UTF-8, name nothing.
 */
export function segmentToFolder(segment: string): string | null {
	const bytes: number[] = [];
	for (let index = 0; index < segment.length; index += 1) {
		const code = segment.charCodeAt(index);
		if (code === UNDERSCORE) {
			const pair = segment.slice(index + 1, index + 3);
			if (!HEX_PAIR.test(pair)) {
				return null;
			}
			bytes.push(Number.parseInt(pair, 16));
			index += 2;
		} else if (isPlain(code) || (code === DOT && index > 0)) {
			bytes.push(code);
		} else {
			return null;
		}
	}
	let id: string;
	try {
		id = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(
			Uint8Array.from(bytes),
		);
	} catch {
		return null;
	}
	return id !== "" && folderToSegment(id) === segment ? id : null;
}
