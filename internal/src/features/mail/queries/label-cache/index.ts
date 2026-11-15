import type { QueryClient } from "@tanstack/react-query";

import { labelKey } from "@/features/mail/labels/keyword-codec";
import { compareLabels } from "@/features/mail/labels/read-keywords";
import { mailKeys } from "@/features/mail/queries/mail-query-keys";
import type { OptimisticWrite } from "@/features/mail/queries/message-cache";
import type {
	LabelView,
	MessageDetail,
	MessageListView,
} from "@/features/mail/schemas/mail-view";

/**
 * What the screen shows of one label on one message: the label when the message
 * carries it, `null` when it does not, `undefined` when no cache holds the
 * message at all.
 */
type Shown = LabelView | null | undefined;

/** A change to one label of one message that the server has not answered yet. */
interface Waiting {
	readonly on: boolean;
}

/** What is known of one label on one message while changes to it wait. */
interface Writes {
	/** What the server last confirmed: the label, or `null` for none. */
	confirmed: Shown;
	waiting: Waiting[];
}

/** The messages with a label change on its way, by query client, and in each the label by key. */
const WRITES = new WeakMap<QueryClient, Map<string, Map<string, Writes>>>();

function writesOf(client: QueryClient): Map<string, Map<string, Writes>> {
	let all = WRITES.get(client);
	if (all === undefined) {
		all = new Map();
		WRITES.set(client, all);
	}
	return all;
}

/** The label `key` of message `id` as the open message or its row in any cached page shows it. */
function shown(client: QueryClient, id: string, key: string): Shown {
	const message = client.getQueryData<MessageDetail | null>(
		mailKeys.message(id),
	);
	if (message) {
		return (
			message.labels.find((label) => labelKey(label.keyword) === key) ??
			null
		);
	}
	for (const [, list] of client.getQueriesData<MessageListView>({
		queryKey: mailKeys.lists,
	})) {
		const row = list?.items.find((item) => item.id === id);
		if (row) {
			return (
				row.labels.find((label) => labelKey(label.keyword) === key) ??
				null
			);
		}
	}
	return undefined;
}

/** `labels` with `label` put on (in its place by name) or taken off. */
function changed(
	labels: readonly LabelView[],
	label: LabelView,
	on: boolean,
): LabelView[] {
	const key = labelKey(label.keyword);
	const rest = labels.filter((one) => labelKey(one.keyword) !== key);
	return on ? [...rest, label].sort(compareLabels) : rest;
}

/** Show `label` of message `id` as on or off: on the open message and on its row in every cached page. */
function show(
	client: QueryClient,
	id: string,
	label: LabelView,
	on: boolean,
): void {
	const message = client.getQueryData<MessageDetail | null>(
		mailKeys.message(id),
	);
	if (message) {
		const next: MessageDetail = {
			...message,
			labels: changed(message.labels, label, on),
		};
		client.setQueryData<MessageDetail | null>(mailKeys.message(id), next);
	}
	for (const [key, list] of client.getQueriesData<MessageListView>({
		queryKey: mailKeys.lists,
	})) {
		if (list?.items.some((item) => item.id === id)) {
			client.setQueryData<MessageListView>(key, {
				...list,
				items: list.items.map((item) =>
					item.id === id
						? { ...item, labels: changed(item.labels, label, on) }
						: item,
				),
			});
		}
	}
}

/**
 * Apply a label change to what is on screen at once, on every message named,
 * and answer for each of them the way the change can end. It is the labels'
 * counterpart of `patchFlags`, with the same rule: the server replaces a
 * message's whole keyword set, so changes to one message wait for each other
 * and a refused one cannot be taken back by its opposite. Each label of each
 * message keeps the value the server last confirmed. A refused change leaves
 * the label at what the last change still waiting on it asked for or, with
 * none left, at the confirmed value; a confirmed one becomes the confirmed
 * value and is shown again unless a later change waits on it.
 *
 * The answers are by message, because a batch can be refused for some of them
 * only: the caller ends each message's write the way the server answered it.
 */
export function patchLabels(
	client: QueryClient,
	ids: readonly string[],
	label: LabelView,
	on: boolean,
): ReadonlyMap<string, OptimisticWrite> {
	const key = labelKey(label.keyword);
	const all = writesOf(client);
	const result = new Map<string, OptimisticWrite>();
	for (const id of ids) {
		const byLabel = all.get(id) ?? new Map<string, Writes>();
		all.set(id, byLabel);
		const writes = byLabel.get(key) ?? {
			confirmed: undefined,
			waiting: [],
		};
		byLabel.set(key, writes);
		if (writes.waiting.length === 0) {
			// Nothing waits on this label: what the screen shows is what the server holds.
			writes.confirmed = shown(client, id, key);
		}
		const mine: Waiting = { on };
		writes.waiting.push(mine);
		show(client, id, label, on);

		const leave = () => {
			writes.waiting = writes.waiting.filter((one) => one !== mine);
			if (writes.waiting.length === 0 && byLabel.get(key) === writes) {
				byLabel.delete(key);
				if (byLabel.size === 0 && all.get(id) === byLabel) {
					all.delete(id);
				}
			}
		};
		/** Whether the label is left on: the last change still waiting on it or, with none, the confirmed value. */
		const holds = (): boolean | undefined =>
			writes.waiting.at(-1)?.on ??
			(writes.confirmed === undefined
				? undefined
				: writes.confirmed !== null);
		result.set(id, {
			confirm() {
				writes.confirmed = on ? label : null;
				leave();
				// A later change that still waits is what is shown.
				show(client, id, label, holds() ?? on);
			},
			refuse() {
				leave();
				const left = holds();
				if (left !== undefined) {
					show(client, id, label, left);
				}
			},
			drop: leave,
		});
	}
	return result;
}

/** How many messages have a label change waiting on this screen. For tests only: nothing may be left once every change has ended. */
export function waitingLabelMessages(client: QueryClient): number {
	return writesOf(client).size;
}
