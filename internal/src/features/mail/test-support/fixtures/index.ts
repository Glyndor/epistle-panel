import type {
	MessageDetail,
	MessageSummary,
} from "@/features/mail/schemas/mail-view";

/** A message as the reader gets it, with `over` on top. */
export const detail = (over: Partial<MessageDetail> = {}): MessageDetail => ({
	id: "m1",
	subject: "Hello",
	from: [{ name: "Ana", email: "ana@example.org" }],
	to: [{ name: null, email: "me@example.org" }],
	cc: [],
	replyTo: [],
	receivedAt: "2026-11-12T10:00:00Z",
	messageId: null,
	unread: false,
	flagged: false,
	important: false,
	answered: false,
	forwarded: false,
	labels: [],
	mailboxId: "INBOX",
	body: { kind: "none" },
	attachments: [],
	headers: [],
	...over,
});

/** A row of the list: a read, plain message, with `over` on top. */
export const summary = (
	over: Partial<MessageSummary> = {},
): MessageSummary => ({
	id: "00000000-0000-4000-8000-0000000000b1",
	from: { name: "Ana Pérez", email: "ana@example.org" },
	subject: "Hello",
	receivedAt: "2026-11-12T10:00:00Z",
	preview: "preview",
	unread: false,
	flagged: false,
	important: false,
	answered: false,
	forwarded: false,
	draft: false,
	hasAttachment: false,
	labels: [],
	...over,
});
