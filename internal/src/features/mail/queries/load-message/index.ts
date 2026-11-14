import "server-only";

import type { MailSession } from "@/features/mail/jmap/credentials";
import type { EmailRecord, Part } from "@/features/mail/jmap/responses";
import { hasKeyword, readLabels } from "@/features/mail/labels/read-keywords";
import {
	loadEmailRecord,
	rawBodies,
} from "@/features/mail/queries/message-body";
import { toAddresses } from "@/features/mail/queries/to-views";
import { safeFilename } from "@/features/mail/sanitize/safe-filename";
import { safeBody, safeLine } from "@/features/mail/sanitize/safe-text";
import { sanitizeHtml } from "@/features/mail/sanitize/sanitize-html";
import type {
	AttachmentView,
	BodyView,
	HeaderView,
	MessageDetail,
} from "@/features/mail/schemas/mail-view";

/** Most raw headers listed in the reader. */
export const MAX_HEADERS = 120;

/** Longest raw header value shown. */
const HEADER_VALUE = 2000;

/** The attachments of a message: the parts that carry a blob and a numeric part index. */
export function attachmentsOf(email: EmailRecord): AttachmentView[] {
	const found: AttachmentView[] = [];
	for (const part of email.attachments ?? []) {
		if (!part.blobId || !part.partId || !/^[0-9]{1,6}$/.test(part.partId)) {
			continue;
		}
		found.push({
			part: part.partId,
			name: safeFilename(part.name),
			type: safeLine(part.type ?? "application/octet-stream", 120),
			size: part.size ?? 0,
		});
	}
	return found;
}

function headersOf(root: Part | null | undefined): HeaderView[] {
	return (root?.headers ?? []).slice(0, MAX_HEADERS).map((header) => ({
		name: safeLine(header.name, 80),
		value: safeLine(header.value, HEADER_VALUE),
	}));
}

function bodyOf(email: EmailRecord): BodyView {
	const raw = rawBodies(email);
	if (raw.html !== null) {
		const sanitized = sanitizeHtml(raw.html, { remoteImages: false });
		if (sanitized.html !== "" || sanitized.blockedImages > 0) {
			return {
				kind: "html",
				blockedImages: sanitized.blockedImages,
				truncated: raw.htmlTruncated || sanitized.truncated,
				alternativeText: raw.text === null ? null : safeBody(raw.text),
			};
		}
	}
	if (raw.text !== null) {
		return {
			kind: "text",
			text: safeBody(raw.text),
			truncated: raw.textTruncated,
		};
	}
	return { kind: "none" };
}

/**
 * A whole message for the reader, or `null` when the server has no such
 * message. Nothing of the HTML itself leaves here: the reader gets the verdict
 * (`html`, how many remote images were held back) and shows the body through
 * the framed route, which sanitises it again on every request.
 */
export async function loadMessage(
	session: MailSession,
	id: string,
): Promise<MessageDetail | null> {
	const email = await loadEmailRecord(session, id);
	if (email === null) {
		return null;
	}
	const keywords = email.keywords ?? {};
	return {
		id: email.id,
		subject: safeLine(email.subject ?? "", 998),
		from: toAddresses(email.from),
		to: toAddresses(email.to),
		cc: toAddresses(email.cc),
		replyTo: toAddresses(email.replyTo),
		receivedAt: email.receivedAt,
		messageId: safeLine(email.messageId?.[0] ?? "", 320) || null,
		unread: keywords["$seen"] !== true,
		flagged: keywords["$flagged"] === true,
		important: hasKeyword(keywords, "$important"),
		answered: keywords["$answered"] === true,
		forwarded: hasKeyword(keywords, "$forwarded"),
		labels: readLabels(keywords),
		mailboxId:
			Object.entries(email.mailboxIds ?? {}).find(([, on]) => on)?.[0] ??
			null,
		body: bodyOf(email),
		attachments: attachmentsOf(email),
		headers: headersOf(email.bodyStructure),
	};
}
