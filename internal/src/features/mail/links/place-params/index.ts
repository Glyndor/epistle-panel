import type { PlaceRef } from "@/features/mail/queries/request-mail";
import {
	mailboxIdSchema,
	messageIdSchema,
} from "@/features/mail/schemas/mail-input";
import {
	MAILBOX_ROLES,
	type MailboxRole,
} from "@/features/mail/schemas/mail-view";
import { segmentToFolder } from "@/lib/folder-segment";
import { isMessageId } from "@/lib/mail-paths";

/**
 * The folder a role segment names (`/app/mail/inbox`), or `null` for a segment
 * that is no role. Only the exact, lower-case names are read: `Inbox` is not a
 * path.
 */
export function placeOfRole(segment: string): PlaceRef | null {
	return (MAILBOX_ROLES as readonly string[]).includes(segment)
		? { role: segment as MailboxRole }
		: null;
}

/**
 * The folder a folder segment names (`/app/mail/folder/<segment>`), or `null`
 * when the segment is not one a link of the panel writes or the name it holds
 * could not be a folder's (a control, a text-direction override, too long).
 */
export function placeOfFolder(segment: string): PlaceRef | null {
	const id = segmentToFolder(segment);
	if (id === null) {
		return null;
	}
	const checked = mailboxIdSchema.safeParse(id);
	return checked.success ? { box: checked.data } : null;
}

/** The message a segment names, or `null` when it is not an id. */
export function messageOfSegment(segment: string): string | null {
	if (!isMessageId(segment)) {
		return null;
	}
	const checked = messageIdSchema.safeParse(segment);
	return checked.success ? checked.data : null;
}
