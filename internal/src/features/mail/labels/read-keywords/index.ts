import {
	isKeywordAtom,
	isLabelKeyword,
	keywordToLabel,
	labelKey,
	MAX_KEYWORDS_PER_MESSAGE,
} from "@/features/mail/labels/keyword-codec";
import { labelTone } from "@/features/mail/labels/label-tone";
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
		// The server only keeps an atom. Anything else is not a keyword it
		// could have sent, and is not shown or handed back to it.
		if (!on || !isKeywordAtom(keyword) || !isLabelKeyword(keyword)) {
			continue;
		}
		const key = labelKey(keyword);
		const name = safeLine(keywordToLabel(keyword), LABEL_TEXT);
		if (name === "" || labels.has(key)) {
			continue;
		}
		labels.set(key, { keyword, name, tone: labelTone(key) });
	}
	return [...labels.values()].sort(
		(a, b) =>
			a.name.localeCompare(b.name) || (a.keyword < b.keyword ? -1 : 1),
	);
}
