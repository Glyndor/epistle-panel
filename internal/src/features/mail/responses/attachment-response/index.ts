import "server-only";

import { downloadBlob, JmapError } from "@/features/mail/jmap/call";
import { currentMailSession } from "@/features/mail/jmap/credentials";
import { loadEmailRecord } from "@/features/mail/queries/message-body";
import {
	attachmentDisposition,
	safeFilename,
} from "@/features/mail/sanitize/safe-filename";
import {
	messageIdSchema,
	partIndexSchema,
} from "@/features/mail/schemas/mail-input";
import { logApiFailure } from "@/lib/api/log-failure";

/** Largest attachment the panel relays, in bytes: epistle's message size cap, 25 MiB. */
export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

/**
 * Types an attachment keeps when it is downloaded. Whatever else the message
 * claims, and every type a browser would run or render as a page (HTML, SVG,
 * XML, script), is sent as `application/octet-stream`. The file is always an
 * attachment, so the browser saves it and renders nothing of it.
 */
const KEPT_TYPES: ReadonlySet<string> = new Set([
	"application/pdf",
	"application/zip",
	"application/gzip",
	"application/json",
	"application/msword",
	"application/vnd.ms-excel",
	"application/vnd.ms-powerpoint",
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
	"application/vnd.openxmlformats-officedocument.presentationml.presentation",
	"image/png",
	"image/jpeg",
	"image/gif",
	"image/webp",
	"audio/mpeg",
	"audio/ogg",
	"video/mp4",
	"text/plain",
	"text/csv",
]);

/** The type to send for an attachment the message says is `declared`. */
export function forcedType(declared: string | null | undefined): string {
	const type = (declared ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
	return KEPT_TYPES.has(type) ? type : "application/octet-stream";
}

function plain(status: number, text: string): Response {
	return new Response(text, {
		status,
		headers: {
			"Content-Type": "text/plain; charset=utf-8",
			"Cache-Control": "private, no-store",
			"X-Content-Type-Options": "nosniff",
		},
	});
}

/**
 * Download one attachment of a message. The id and the part are checked, the
 * part must be one the message lists as an attachment, and the blob fetched is
 * the one it lists for that part (the route never turns a number from the URL
 * into a blob on its own); the name is cleaned, the type forced to one a
 * browser does not render as a page, and the file sent as an attachment with
 * `nosniff`, so nothing in it is run or drawn in the panel's origin. The proxy
 * sends the panel's own security headers on this response, its
 * Content-Security-Policy included; this handler sets none of its own, since
 * the proxy would replace it.
 */
export async function attachmentResponse(
	id: string,
	part: string,
): Promise<Response> {
	if (
		!messageIdSchema.safeParse(id).success ||
		!partIndexSchema.safeParse(part).success
	) {
		return plain(404, "Not found");
	}
	try {
		const session = await currentMailSession();
		if (session === null) {
			return plain(401, "Unauthorized");
		}
		const email = await loadEmailRecord(session, id);
		const listed = email?.attachments?.find(
			(candidate) => candidate.partId === part && candidate.blobId,
		);
		const blobId = listed?.blobId;
		if (!listed || !blobId) {
			return plain(404, "Not found");
		}
		const blob = await downloadBlob(
			session,
			blobId,
			MAX_ATTACHMENT_BYTES,
		);
		return new Response(blob.bytes as BodyInit, {
			status: 200,
			headers: {
				"Content-Type": forcedType(listed.type),
				"Content-Disposition": attachmentDisposition(
					safeFilename(listed.name),
				),
				"Content-Length": String(blob.bytes.byteLength),
				"X-Content-Type-Options": "nosniff",
				"Cache-Control": "private, no-store",
				"Referrer-Policy": "no-referrer",
				"X-Robots-Tag": "noindex, nofollow",
			},
		});
	} catch (error) {
		if (error instanceof JmapError && error.failure === "notFound") {
			return plain(404, "Not found");
		}
		logApiFailure("mail attachment", error);
		return plain(502, "Unavailable");
	}
}
