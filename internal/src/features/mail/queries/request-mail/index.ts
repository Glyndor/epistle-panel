import "server-only";

import { cache } from "react";

import {
	currentMailSession,
	type MailSession,
} from "@/features/mail/jmap/credentials";
import { loadMailboxes } from "@/features/mail/queries/load-mailboxes";
import { loadMessage } from "@/features/mail/queries/load-message";
import { loadQuota } from "@/features/mail/queries/load-quota";
import type {
	MailboxRole,
	MailboxView,
	MessageDetail,
	QuotaView,
} from "@/features/mail/schemas/mail-view";
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

/** The folder a page asks for: the account's folder of a role, or a folder by its id. */
export type PlaceRef =
	| { readonly role: MailboxRole }
	| { readonly box: string };

/** The folder a place is: its id, and its role when the place was asked for by role. */
export interface ResolvedPlace {
	/** `null` when no folder could be named for the role asked for: see `unreadable`. */
	readonly box: string | null;
	readonly role: MailboxRole | null;
	/** With no `box`: the folders could not be read (true), or they were and none has the role (false). */
	readonly unreadable: boolean;
}

/**
 * The account's storage, asked of the server once per request. A failure is
 * logged once and answered as `undefined`, and an account with no quota in
 * octets as `null`: the page then shows no meter, and nothing else waits on it.
 */
export const requestQuota: () => Promise<QuotaView | null | undefined> = cache(
	async () => {
		const session = await requestMailSession();
		if (session === null) {
			return undefined;
		}
		try {
			return await loadQuota(session);
		} catch (error) {
			logApiFailure("mail quota", error);
			return undefined;
		}
	},
);

/**
 * One message, asked of the server once per request however many parts of the
 * page show it: the reader, and the trail of the bar, which names its subject.
 * `undefined` without a mail session and `null` for a message the server does
 * not have. A failure rejects, for every caller alike: the reader logs it and
 * lets the browser ask again, the trail names nothing.
 */
export const requestMessage: (
	id: string,
) => Promise<MessageDetail | null | undefined> = cache(async (id: string) => {
	const session = await requestMailSession();
	return session === null ? undefined : loadMessage(session, id);
});

/**
 * The folder a view opens. A place asked for by its id is that folder and
 * waits for nothing. One asked for by role waits for the folders and is the
 * first with that role; when there is none the inbox falls back to
 * {@link FALLBACK_BOX}, so a mailbox whose folders could not be read still
 * opens, and any other role has no folder.
 */
export async function resolvePlace(place: PlaceRef): Promise<ResolvedPlace> {
	if ("box" in place) {
		return { box: place.box, role: null, unreadable: false };
	}
	const boxes = await requestMailboxes();
	const found = boxes?.find((box) => box.role === place.role)?.id;
	if (found !== undefined) {
		return { box: found, role: place.role, unreadable: false };
	}
	return place.role === "inbox"
		? { box: FALLBACK_BOX, role: "inbox", unreadable: false }
		: { box: null, role: place.role, unreadable: boxes === undefined };
}
