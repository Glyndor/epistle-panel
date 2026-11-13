/** The roles epistle gives a mailbox, as JMAP spells them. */
export const MAILBOX_ROLES = [
	"inbox",
	"drafts",
	"sent",
	"archive",
	"junk",
	"trash",
] as const;
export type MailboxRole = (typeof MAILBOX_ROLES)[number];

/** One mailbox as the folder tree shows it. `name` is already safe text. */
export interface MailboxView {
	readonly id: string;
	readonly name: string;
	readonly role: MailboxRole | null;
	readonly parentId: string | null;
	/** Nesting level in the tree, `0` for a top-level mailbox. */
	readonly depth: number;
	readonly unread: number;
	readonly total: number;
}

/** A sender or recipient. Both fields are already safe text. */
export interface AddressView {
	readonly name: string | null;
	readonly email: string;
}

/** One row of the message list. Every text is already safe text. */
export interface MessageSummary {
	readonly id: string;
	readonly from: AddressView | null;
	readonly subject: string;
	readonly receivedAt: string;
	readonly preview: string;
	readonly unread: boolean;
	readonly flagged: boolean;
	readonly answered: boolean;
	readonly draft: boolean;
	readonly hasAttachment: boolean;
}

/** One page of a folder's messages. */
export interface MessageListView {
	readonly items: readonly MessageSummary[];
	readonly page: number;
	/** Messages that match the filter and the search, within what was scanned. */
	readonly total: number;
	readonly hasNext: boolean;
	/** True when a filter or a search read only the newest part of a larger folder. */
	readonly partial: boolean;
}

/** One attachment of a message. */
export interface AttachmentView {
	/** The MIME part index, digits only, which names the download route. */
	readonly part: string;
	readonly name: string;
	readonly type: string;
	readonly size: number;
}

/** A header of the message, name and value as safe text. */
export interface HeaderView {
	readonly name: string;
	readonly value: string;
}

/** How the body is shown: sanitised HTML in a frame, plain text, or there is none. */
export type BodyView =
	| {
			readonly kind: "html";
			/** Remote images held back, so the reader can offer to load them. */
			readonly blockedImages: number;
			readonly truncated: boolean;
			/** The text version, when the message has one too. */
			readonly alternativeText: string | null;
	  }
	| {
			readonly kind: "text";
			readonly text: string;
			readonly truncated: boolean;
	  }
	| { readonly kind: "none" };

/** A whole message for the reader. */
export interface MessageDetail {
	readonly id: string;
	readonly subject: string;
	readonly from: readonly AddressView[];
	readonly to: readonly AddressView[];
	readonly cc: readonly AddressView[];
	readonly replyTo: readonly AddressView[];
	readonly receivedAt: string;
	readonly messageId: string | null;
	readonly unread: boolean;
	readonly flagged: boolean;
	readonly mailboxId: string | null;
	readonly body: BodyView;
	readonly attachments: readonly AttachmentView[];
	readonly headers: readonly HeaderView[];
}
