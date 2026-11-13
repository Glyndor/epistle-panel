import "server-only";

import { cache } from "react";

import {
	currentMailSession,
	type MailSession,
} from "@/features/mail/jmap/credentials";
import { loadMailboxes } from "@/features/mail/queries/load-mailboxes";
import type { MailboxView } from "@/features/mail/schemas/mail-view";
import { logApiFailure } from "@/lib/api/log-failure";

/** The folder shown when the address names none and the server has no mailbox with the inbox role. */
export const FALLBACK_BOX = "INBOX";

/**
 * The mail session of the request, read once however many parts of the page
 * ask for it. It stays on the server: it is never a prop of a client
 * component, so the bearer in it never reaches the browser.
 */
export const requestMailSession: () => Promise<MailSession | null> = cache(() =>
	currentMailSession(),
);

/**
 * The account's folders, asked of the server once per request and shared by
 * every pane that needs them. A failure is logged once and answered as
 * `undefined`: each pane then renders without them and its client component
 * asks for itself.
 */
export const requestMailboxes: () => Promise<MailboxView[] | undefined> = cache(
	async () => {
		const session = await requestMailSession();
		if (session === null) {
			return undefined;
		}
		try {
			return await loadMailboxes(session);
		} catch (error) {
			logApiFailure("mail mailboxes", error);
			return undefined;
		}
	},
);

/**
 * The folder a view opens: the one the address names, or the account's inbox
 * by its role, or {@link FALLBACK_BOX} when the folders could not be read.
 * Only a view without a folder in its address waits for the folders.
 */
export async function resolveBox(asked: string | undefined): Promise<string> {
	if (asked !== undefined) {
		return asked;
	}
	const boxes = await requestMailboxes();
	return boxes?.find((box) => box.role === "inbox")?.id ?? FALLBACK_BOX;
}
