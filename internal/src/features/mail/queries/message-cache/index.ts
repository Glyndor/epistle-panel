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
type Flag = keyof Flags;

/** The flag each keyword operation sets, and the value it sets it to. */
const SETS: Partial<Record<MessageOp, readonly [Flag, boolean]>> = {
	read: ["unread", false],
	unread: ["unread", true],
	star: ["flagged", true],
	unstar: ["flagged", false],
	important: ["important", true],
	unimportant: ["important", false],
};

/** A change to one flag that the server has not answered yet. */
interface Waiting {
	readonly flag: Flag;
	readonly value: boolean;
}

/**
 * What is known of one message while changes to it wait: the value of each
 * flag the server last confirmed, and the changes still on their way, in the
 * order they were asked for.
 */
interface Writes {
	readonly confirmed: Partial<Record<Flag, boolean>>;
	waiting: Waiting[];
}

/** The messages with a change on its way, by query client: two clients are two screens. */
const WRITES = new WeakMap<QueryClient, Map<string, Writes>>();

function writesOf(client: QueryClient): Map<string, Writes> {
	let all = WRITES.get(client);
	if (all === undefined) {
		all = new Map();
		WRITES.set(client, all);
	}
	return all;
}

/** The value of `flag` the screen shows for message `id`, from the open message or from its row in any cached page. */
function shown(
	client: QueryClient,
	id: string,
	flag: Flag,
): boolean | undefined {
	const message = client.getQueryData<MessageDetail | null>(
		mailKeys.message(id),
	);
	if (message) {
		return message[flag];
	}
	for (const [, list] of client.getQueriesData<MessageListView>({
		queryKey: mailKeys.lists,
	})) {
		const row = list?.items.find((item) => item.id === id);
		if (row) {
			return row[flag];
		}
	}
	return undefined;
}

/**
 * Show `flag` of message `id` as `value`: on the open message, on its row in
 * every cached page and, for the read state, on the folder's unread counter,
 * which moves only when the value shown really changes.
 */
function show(
	client: QueryClient,
	id: string,
	flag: Flag,
	value: boolean,
	mailboxId: string | null,
): void {
	const before = shown(client, id, flag);
	const message = client.getQueryData<MessageDetail | null>(
		mailKeys.message(id),
	);
	if (message) {
		client.setQueryData<MessageDetail | null>(mailKeys.message(id), {
			...message,
			[flag]: value,
		});
	}
	for (const [key, list] of client.getQueriesData<MessageListView>({
		queryKey: mailKeys.lists,
	})) {
		if (list?.items.some((item) => item.id === id)) {
			client.setQueryData<MessageListView>(key, {
				...list,
				items: list.items.map((item) =>
					item.id === id ? { ...item, [flag]: value } : item,
				),
			});
		}
	}
	const boxes = client.getQueryData<MailboxView[]>(mailKeys.mailboxes);
	if (
		flag === "unread" &&
		boxes &&
		mailboxId !== null &&
		before !== undefined &&
		before !== value
	) {
		const delta = value ? 1 : -1;
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

/** One change that shows and waits: what to call when the server has answered. */
export interface OptimisticWrite {
	/** The server made the change: its value is now the confirmed one. */
	confirm(): void;
	/** The server refused the change: the screen goes back to what still holds. */
	refuse(): void;
}

const NOTHING: OptimisticWrite = { confirm() {}, refuse() {} };

/**
 * Apply a keyword operation to what is on screen at once: the open message, its
 * row in every cached page, and the folder's unread counter. It answers the
 * two ways the change can end.
 *
 * Several changes to one message wait for each other, so a refused one cannot
 * be taken back by its opposite: with a star and then its removal both
 * refused, the opposite of the second (computed over the first, which never
 * held) would leave a star the server does not have. Each flag keeps the value
 * the server last confirmed. A refused change leaves the flag at the value of
 * the last change still waiting on it or, with none left, at the confirmed
 * one. A change the server made becomes the confirmed value.
 */
export function patchFlags(
	client: QueryClient,
	id: string,
	op: MessageOp,
	mailboxId: string | null,
): OptimisticWrite {
	const sets = SETS[op];
	if (sets === undefined) {
		return NOTHING;
	}
	const [flag, value] = sets;
	const all = writesOf(client);
	const writes = all.get(id) ?? { confirmed: {}, waiting: [] };
	all.set(id, writes);
	if (!writes.waiting.some((one) => one.flag === flag)) {
		// Nothing waits on this flag: what the screen shows is what the server holds.
		const current = shown(client, id, flag);
		if (current !== undefined) {
			writes.confirmed[flag] = current;
		}
	}
	const mine: Waiting = { flag, value };
	writes.waiting.push(mine);
	show(client, id, flag, value, mailboxId);

	const leave = () => {
		writes.waiting = writes.waiting.filter((one) => one !== mine);
		if (writes.waiting.length === 0 && all.get(id) === writes) {
			all.delete(id);
		}
	};
	return {
		confirm() {
			writes.confirmed[flag] = value;
			leave();
		},
		refuse() {
			leave();
			const holds =
				writes.waiting.findLast((one) => one.flag === flag)?.value ??
				writes.confirmed[flag];
			if (holds !== undefined) {
				show(client, id, flag, holds, mailboxId);
			}
		},
	};
}

/** The messages that left their folder on this screen, by query client. */
const GONE = new WeakMap<QueryClient, Set<string>>();

/**
 * Note that message `id` left its folder: the server gave it another id, so a
 * change still waiting for the old one would be written to a message that is
 * no longer there.
 */
export function markGone(client: QueryClient, id: string): void {
	const gone = GONE.get(client) ?? new Set<string>();
	GONE.set(client, gone);
	gone.add(id);
	writesOf(client).delete(id);
}

/** Whether message `id` left its folder on this screen. */
export function isGone(client: QueryClient, id: string): boolean {
	return GONE.get(client)?.has(id) ?? false;
}
