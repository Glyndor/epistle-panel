import { safeLine } from "@/features/mail/sanitize/safe-text";

/** Longest folder name put in a page title, a heading or a trail. */
const NAME_TEXT = 80;

/**
 * The name of a folder that has no role, as a page shows it: the last part of
 * its own name (`Work/Q4` is "Q4"), cleaned like any text the account wrote.
 * A name whose last part cleans to nothing falls back to the whole name, and
 * that to an empty string.
 */
export function folderName(box: string): string {
	const last = box.split("/").at(-1) ?? "";
	return safeLine(last, NAME_TEXT) || safeLine(box, NAME_TEXT);
}
