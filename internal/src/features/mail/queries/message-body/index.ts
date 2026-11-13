import "server-only";

import { jmapCall, methodResult } from "@/features/mail/jmap/call";
import type { MailSession } from "@/features/mail/jmap/credentials";
import {
	type EmailRecord,
	emailGetSchema,
} from "@/features/mail/jmap/responses";

/** Largest body value asked of the server and read, in bytes. */
export const MAX_BODY_BYTES = 1_048_576;

/** What the reader and the attachment route ask `Email/get` for. */
export async function loadEmailRecord(
	session: MailSession,
	id: string,
): Promise<EmailRecord | null> {
	const responses = await jmapCall(session, [
		[
			"Email/get",
			{
				accountId: session.accountId,
				ids: [id],
				fetchTextBodyValues: true,
				fetchHTMLBodyValues: true,
				maxBodyValueBytes: MAX_BODY_BYTES,
				bodyProperties: [
					"partId",
					"blobId",
					"size",
					"name",
					"type",
					"disposition",
					"cid",
					"headers",
				],
			},
			"g",
		],
	]);
	return (
		methodResult(responses, "g", "Email/get", emailGetSchema).list[0] ??
		null
	);
}

/** The raw bodies of a message, before any sanitising. */
export interface RawBodies {
	readonly html: string | null;
	readonly htmlTruncated: boolean;
	readonly text: string | null;
	readonly textTruncated: boolean;
}

/** The value of the first body part of `type` that has one. */
function bodyValue(
	email: EmailRecord,
	parts: EmailRecord["htmlBody"],
	type: string,
): { value: string; truncated: boolean } | null {
	for (const part of parts ?? []) {
		if (part.type !== type || !part.partId) {
			continue;
		}
		const value = email.bodyValues?.[part.partId];
		if (value) {
			return {
				value: value.value,
				truncated: value.isTruncated === true,
			};
		}
	}
	return null;
}

/**
 * The HTML and the plain-text body of a message. A body list can hold the HTML
 * part where there is no text alternative, so each is picked by its type.
 */
export function rawBodies(email: EmailRecord): RawBodies {
	const html = bodyValue(email, email.htmlBody, "text/html");
	const text = bodyValue(email, email.textBody, "text/plain");
	return {
		html: html?.value ?? null,
		htmlTruncated: html?.truncated ?? false,
		text: text?.value ?? null,
		textTruncated: text?.truncated ?? false,
	};
}
