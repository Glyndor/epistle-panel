import { labelKey } from "@/features/mail/labels/keyword-codec";
import type {
	LabelView,
	MessageSummary,
} from "@/features/mail/schemas/mail-view";

/** The most labels the sidebar lists: the ones carried by the most of the messages it has seen. */
export const SIDEBAR_LABELS_MOST = 20;

/** A label of the sidebar: how it is drawn, and on how many of the messages seen it is. */
export interface SidebarLabel extends LabelView {
	/** The messages seen that carry it, each counted once however many pages hold it. */
	readonly count: number;
}

/** What the sidebar reads of a message: which one it is and the labels it carries. */
export type SeenMessage = Pick<MessageSummary, "id" | "labels">;

/**
 * The labels of the messages the panel has read lately, for the sidebar to
 * list. `pages` come newest read first: a message that is on more than one
 * (a folder's page and the same page under a search) is counted once, by the
 * page read most recently, so a label taken off since is not listed from an older
 * page. Two spellings of one keyword are one label, drawn as the first one
 * seen, the way the server holds them as one.
 *
 * Only {@link SIDEBAR_LABELS_MOST} are kept, the most carried first and, among
 * equals, by name, and they come back by name, so the list does not move when
 * a count does. Messages with no label add nothing, and no label at all is an
 * empty list.
 */
export function collectSidebarLabels(
	pages: readonly (readonly SeenMessage[])[],
): SidebarLabel[] {
	const seen = new Set<string>();
	const found = new Map<string, { label: LabelView; count: number }>();
	for (const page of pages) {
		for (const message of page) {
			if (seen.has(message.id)) {
				continue;
			}
			seen.add(message.id);
			for (const label of message.labels) {
				const key = labelKey(label.keyword);
				const entry = found.get(key);
				if (entry === undefined) {
					found.set(key, { label, count: 1 });
				} else {
					entry.count += 1;
				}
			}
		}
	}
	return [...found.values()]
		.map(({ label, count }) => ({ ...label, count }))
		.sort((a, b) => b.count - a.count || byName(a, b))
		.slice(0, SIDEBAR_LABELS_MOST)
		.sort(byName);
}

/** By name, and by keyword when two names read the same. */
function byName(a: LabelView, b: LabelView): number {
	return a.name.localeCompare(b.name) || (a.keyword < b.keyword ? -1 : 1);
}
