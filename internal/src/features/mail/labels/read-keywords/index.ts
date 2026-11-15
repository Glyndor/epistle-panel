import {
	isKeywordAtom,
	isLabelKeyword,
	keywordToLabel,
	labelKey,
	MAX_KEYWORDS_PER_MESSAGE,
} from "@/features/mail/labels/keyword-codec";
import { labelTone } from "@/features/mail/labels/label-tone";
import { decodeLabelKeyword } from "@/features/mail/labels/name-codec";
import { safeLine } from "@/features/mail/sanitize/safe-text";
import type { LabelView } from "@/features/mail/schemas/mail-view";

/** Longest label name shown: a keyword is at most 64 bytes, so a name is never longer. */
const LABEL_TEXT = 64;

/**
 * Whether the message carries a keyword. The four JMAP names (`$seen`,
 * `$flagged`, `$answered`, `$draft`) always come in lower case, but epistle
 * returns every other keyword as it was set, and an IMAP client sets
 * `$Important` where a JMAP client sets `$important`: the server matches them
 * as one, so this does too.
 */
export function hasKeyword(
	keywords: Readonly<Record<string, boolean>> | undefined,
	name: string,
): boolean {
	const wanted = name.toLowerCase();
	for (const [keyword, on] of Object.entries(keywords ?? {})) {
		if (on && keyword.toLowerCase() === wanted) {
			return true;
		}
	}
	return false;
}

/**
 * The label one keyword is, as it is shown, or `null` when it is not one a
 * person sees: not an atom the server keeps, a keyword of the protocol, or a
 * name that is nothing once it is cleaned. A keyword made by the label
 * controls (`ep1-` and the name's bytes in hex, see `name-codec`) is shown as
 * the exact name it holds, and its tone follows that name. Any other keyword
 * is shown as the old codec reads it. The keyword stays the label's identity
 * whatever name it is shown under.
 */
export function labelOf(keyword: string): LabelView | null {
	// The server only keeps an atom. Anything else is not a keyword it
	// could have sent, and is not shown or handed back to it.
	if (!isKeywordAtom(keyword) || !isLabelKeyword(keyword)) {
		return null;
	}
	const exact = decodeLabelKeyword(keyword);
	const name = safeLine(exact ?? keywordToLabel(keyword), LABEL_TEXT);
	if (name === "") {
		return null;
	}
	return { keyword, name, tone: labelTone(exact ?? labelKey(keyword)) };
}

/** The order labels are listed in: by name, then by keyword. */
export function compareLabels(a: LabelView, b: LabelView): number {
	return a.name.localeCompare(b.name) || (a.keyword < b.keyword ? -1 : 1);
}

/**
 * The labels a message carries, by name. A keyword of the protocol is not a
 * label, two spellings of one keyword are one label, and a name is cleaned
 * like any other text of a message before it is shown. At most what the
 * server lets a message carry is read.
 */
export function readLabels(
	keywords: Readonly<Record<string, boolean>> | undefined,
): LabelView[] {
	const labels = new Map<string, LabelView>();
	for (const [keyword, on] of Object.entries(keywords ?? {})) {
		if (labels.size >= MAX_KEYWORDS_PER_MESSAGE) {
			break;
		}
		const key = labelKey(keyword);
		const label = on ? labelOf(keyword) : null;
		if (label !== null && !labels.has(key)) {
			labels.set(key, label);
		}
	}
	return [...labels.values()].sort(compareLabels);
}
