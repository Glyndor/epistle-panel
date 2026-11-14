import type { QueryClient } from "@tanstack/react-query";

import type { MessageOp } from "@/features/mail/schemas/mail-input";
import type {
	MailboxView,
	MessageDetail,
	MessageListView,
} from "@/features/mail/schemas/mail-view";
import { mailKeys } from "../mail-query-keys";

/** The keyword operations: they change flags and leave the message where it is. */
const KEYWORD_OPS = new Set<MessageOp>([
	"read",
	"unread",
	"star",
	"unstar",
	"important",
	"unimportant",
]);

/** Whether `op` only changes a flag. */
export function isKeywordOp(op: MessageOp | "move"): boolean {
	return op !== "move" && KEYWORD_OPS.has(op);
}

/** The flags of a message a keyword operation can change. */
interface Flags {
	readonly unread: boolean;
	readonly flagged: boolean;
	readonly important: boolean;
}

/** What a keyword operation does to the flags the interface shows. */
function flagsAfter(op: MessageOp, flags: Flags): Flags {
	const { unread, flagged, important } = flags;
	switch (op) {
		case "read":
			return { unread: false, flagged, important };
		case "unread":
			return { unread: true, flagged, important };
		case "star":
			return { unread, flagged: true, important };
		case "unstar":
			return { unread, flagged: false, important };
		case "important":
			return { unread, flagged, important: true };
		case "unimportant":
			return { unread, flagged, important: false };
		default:
			return { unread, flagged, important };
	}
}

/**
 * Apply a keyword operation to what is on screen at once: the open message, its
 * row in every cached page, and the folder's unread counter. It returns a
 * function that puts all of it back, for a change the server refused.
 */
export function patchFlags(
	client: QueryClient,
	id: string,
	op: MessageOp,
	mailboxId: string | null,
): () => void {
	const message = client.getQueryData<MessageDetail | null>(
		mailKeys.message(id),
	);
	const lists = client.getQueriesData<MessageListView>({
		queryKey: mailKeys.lists,
	});
	const boxes = client.getQueryData<MailboxView[]>(mailKeys.mailboxes);
	let wasUnread: boolean | undefined = message?.unread;

	if (message) {
		client.setQueryData<MessageDetail | null>(mailKeys.message(id), {
			...message,
			...flagsAfter(op, message),
		});
	}
	for (const [key, list] of lists) {
		if (!list) {
			continue;
		}
		client.setQueryData<MessageListView>(key, {
			...list,
			items: list.items.map((item) => {
				if (item.id !== id) {
					return item;
				}
				wasUnread ??= item.unread;
				return {
					...item,
					...flagsAfter(op, item),
				};
			}),
		});
	}
	if (boxes && mailboxId !== null && wasUnread !== undefined) {
		const delta =
			op === "read" && wasUnread
				? -1
				: op === "unread" && !wasUnread
					? 1
					: 0;
		if (delta !== 0) {
			client.setQueryData<MailboxView[]>(
				mailKeys.mailboxes,
				boxes.map((box) =>
					box.id === mailboxId
						? { ...box, unread: Math.max(0, box.unread + delta) }
						: box,
				),
			);
		}
	}
	return () => {
		if (message) {
			client.setQueryData(mailKeys.message(id), message);
		}
		for (const [key, list] of lists) {
			client.setQueryData(key, list);
		}
		if (boxes) {
			client.setQueryData(mailKeys.mailboxes, boxes);
		}
	};
}
