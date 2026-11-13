import { safeLine } from "../safe-text";

/** Longest file name offered for download, in UTF-16 code units. */
export const MAX_FILENAME_LENGTH = 120;

/** What a download is called when the message's name for it is unusable. */
export const FALLBACK_FILENAME = "attachment";

/** Characters a file system or a shell gives a meaning to, plus the quote and percent a header does. */
const UNSAFE = /[\\/:*?"<>|%;`$&'(){}[\]!#^~=,]/gu;

/** Names Windows refuses or treats as a device, with or without an extension. */
const RESERVED = /^(?:con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\..*)?$/iu;

/**
 * A file name taken from a message, made safe to offer for download: one path
 * segment, no control, bidi or separator character, nothing a shell or a
 * header gives a meaning to, no leading or trailing dot or space, no device
 * name, at most {@link MAX_FILENAME_LENGTH} characters with the extension
 * kept. The name is a label, never a path: whatever it said about
 * directories is gone.
 */
export function safeFilename(raw: string | null | undefined): string {
	const base = (raw ?? "")
		.split(/[\\/]/u)
		.filter(
			(segment) => segment !== "" && segment !== "." && segment !== "..",
		)
		.at(-1);
	let name = safeLine(base ?? "")
		.replace(UNSAFE, "_")
		.replace(/^[. ]+|[. ]+$/gu, "");
	if (name.length > MAX_FILENAME_LENGTH) {
		const dot = name.lastIndexOf(".");
		const extension =
			dot > 0 && name.length - dot <= 12 ? name.slice(dot) : "";
		name = `${name.slice(0, MAX_FILENAME_LENGTH - extension.length)}${extension}`;
	}
	if (name === "" || RESERVED.test(name)) {
		return FALLBACK_FILENAME;
	}
	return name;
}

/** `Content-Disposition` value that makes a browser save the file under `name`. */
export function attachmentDisposition(name: string): string {
	const ascii = name.replace(/[^\x20-\x7E]/gu, "_");
	return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}
