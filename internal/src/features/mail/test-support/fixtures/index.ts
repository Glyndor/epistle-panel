import type { MessageDetail } from "@/features/mail/schemas/mail-view";

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
	mailboxId: "INBOX",
	body: { kind: "none" },
	attachments: [],
	headers: [],
	...over,
});
