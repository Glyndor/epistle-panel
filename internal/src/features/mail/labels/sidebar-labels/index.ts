import { labelKey } from "../keyword-codec";
import type { MessageLabel } from "../message-labels";

/** A label and the number of latest messages that carry it. */
export interface SidebarLabel extends MessageLabel {
	readonly count: number;
}

/**
 * Labels "seen in the latest messages", never an account-wide inventory.
 * The caller supplies each latest message once. Count a keyword once per
 * message, retain its first spelling for removal, and sort by exact name
 * (UTF-16 order, independent of browser/server locale), then by keyword key.
 * Raw and encoded labels with equal display names remain separate identities.
 */
export function sidebarLabels(
	messages: Iterable<readonly MessageLabel[]>,
): SidebarLabel[] {
	const labels = new Map<string, SidebarLabel>();
	for (const message of messages) {
		const seen = new Set<string>();
		for (const label of message) {
			const key = labelKey(label.keyword);
			if (seen.has(key)) continue;
			seen.add(key);
			const previous = labels.get(key);
			labels.set(key, {
				...(previous ?? label),
				count: (previous?.count ?? 0) + 1,
			});
		}
	}
	return [...labels.values()].sort((a, b) => {
		const first = a.name === b.name ? labelKey(a.keyword) : a.name;
		const second = a.name === b.name ? labelKey(b.keyword) : b.name;
		return first < second ? -1 : first > second ? 1 : 0;
	});
}
