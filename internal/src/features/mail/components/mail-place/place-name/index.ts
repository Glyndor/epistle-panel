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

/**
 * The names of the folders above a folder, outermost first, each cleaned like
 * the folder's own (`Work/2026/Q4` is under "Work" and "2026"). A part that
 * cleans to nothing is left out, and a folder whose own name fell back to the
 * whole of it has none above: the whole name is already what is shown.
 */
export function foldersAbove(box: string): string[] {
	const parts = box.split("/");
	if (safeLine(parts.at(-1) ?? "", NAME_TEXT) === "") {
		return [];
	}
	return parts
		.slice(0, -1)
		.map((part) => safeLine(part, NAME_TEXT))
		.filter((part) => part !== "");
}
