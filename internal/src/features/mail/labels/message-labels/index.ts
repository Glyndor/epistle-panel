import { isKeywordAtom, labelKey } from "../keyword-codec";
import { type LabelTone, labelTone } from "../label-tone";
import { decodeLabelKeyword } from "../name-codec";

/** Pure label identity; raw keywords remain removable by their exact keyword. */
export interface MessageLabel {
	readonly keyword: string;
	readonly name: string;
	readonly raw: boolean;
	readonly tone: LabelTone;
}

/**
 * Read a message's keyword set, excluding every $ or backslash system keyword.
 * Unknown encodings are raw labels, including unprefixed IMAP client keywords.
 * No display sanitizing: presentation must isolate/escape text without changing
 * the identity. Keywords are deduplicated using the server's ASCII case rule.
 */
export function messageLabels(keywords: Iterable<string>): MessageLabel[] {
	const labels = new Map<string, MessageLabel>();
	for (const keyword of keywords) {
		if (!isKeywordAtom(keyword) || keyword.startsWith("$")) continue;
		const key = labelKey(keyword);
		if (labels.has(key)) continue;
		const decoded = decodeLabelKeyword(keyword);
		const name = decoded ?? keyword;
		labels.set(key, {
			keyword,
			name,
			raw: decoded === null,
			tone: labelTone(name),
		});
	}
	return [...labels.values()];
}
