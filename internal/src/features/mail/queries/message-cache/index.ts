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

/** The operation that takes `op` back. */
const INVERSE: Partial<Record<MessageOp, MessageOp>> = {
	read: "unread",
	unread: "read",
	star: "unstar",
	unstar: "star",
	important: "unimportant",
	unimportant: "important",
};

/** Whether `op` changes any of `flags`. */
function changes(op: MessageOp, flags: Flags): boolean {
	const after = flagsAfter(op, flags);
	return (
		after.unread !== flags.unread ||
		after.flagged !== flags.flagged ||
		after.important !== flags.important
	);
}

/** Apply `op` to the open message, its row in every cached page and the folder's unread counter. Answers whether it changed the message. */
function apply(
	client: QueryClient,
	id: string,
	op: MessageOp,
	mailboxId: string | null,
): boolean {
	const message = client.getQueryData<MessageDetail | null>(
		mailKeys.message(id),
	);
	const lists = client.getQueriesData<MessageListView>({
		queryKey: mailKeys.lists,
	});
	const boxes = client.getQueryData<MailboxView[]>(mailKeys.mailboxes);
	let before: Flags | undefined = message ?? undefined;

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
				before ??= item;
				return {
					...item,
					...flagsAfter(op, item),
				};
			}),
		});
	}
	if (before === undefined) {
		return false;
	}
	if (boxes && mailboxId !== null) {
		const delta =
			op === "read" && before.unread
				? -1
				: op === "unread" && !before.unread
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
	return changes(op, before);
}

/**
 * Apply a keyword operation to what is on screen at once: the open message, its
 * row in every cached page, and the folder's unread counter. It returns a
 * function that takes that one change back, for a change the server refused.
 *
 * Taking it back is the opposite operation applied to what is cached by then,
 * not a copy of what was there before: several changes to one message wait
 * for each other, and a copy from before the first would also take back every
 * change made after it. An operation that changed nothing takes nothing back.
 */
export function patchFlags(
	client: QueryClient,
	id: string,
	op: MessageOp,
	mailboxId: string | null,
): () => void {
	const changed = apply(client, id, op, mailboxId);
	const inverse = INVERSE[op];
	return () => {
		if (changed && inverse !== undefined) {
			apply(client, id, inverse, mailboxId);
		}
	};
}
