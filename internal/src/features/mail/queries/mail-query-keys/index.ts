import type { ListFilter } from "@/features/mail/schemas/mail-input";

/** Query keys of the webmail. A message list is keyed by everything that selects it. */
export const mailKeys = {
	all: ["mail"] as const,
	mailboxes: ["mail", "mailboxes"] as const,
	lists: ["mail", "list"] as const,
	list: (box: string, page: number, filter: ListFilter, q: string) =>
		["mail", "list", box, page, filter, q] as const,
	message: (id: string) => ["mail", "message", id] as const,
	/** The changes made to any message: every one still on its way to the server. */
	changes: ["mail", "change"] as const,
	/** The changes made to one message: what is still on its way to the server for it. */
	change: (id: string) => ["mail", "change", id] as const,
};

/** How often the folder counters and the open list refresh while the tab is in view, in milliseconds. */
export const MAIL_REFRESH_MS = 30_000;
