import "server-only";

import { currentMailSession } from "@/features/mail/jmap/credentials";
import {
	loadEmailRecord,
	rawBodies,
} from "@/features/mail/queries/message-body";
import {
	bodyDocument,
	bodyHeaders,
} from "@/features/mail/sanitize/body-document";
import { sanitizeHtml } from "@/features/mail/sanitize/sanitize-html";
import { messageIdSchema } from "@/features/mail/schemas/mail-input";
import { logApiFailure } from "@/lib/api/log-failure";

/** A plain answer with no markup and nothing cached, for the cases that show no body. */
function plain(status: number, text: string): Response {
	return new Response(text, {
		status,
		headers: {
			...bodyHeaders(false),
			"Content-Type": "text/plain; charset=utf-8",
		},
	});
}

/**
 * The page the reader's frame loads: one message's HTML body, sanitised on this
 * request and served under its own Content-Security-Policy (see
 * `body-document`). The session is checked here as well as by the proxy, the id
 * is checked before anything is asked of JMAP, and remote images stay blocked
 * unless the reader asked for them. `theme` is what the frame's address says
 * the page around it is pinned to; `bodyDocument` decides what it is worth.
 * A message with no HTML body is a 404: the
 * reader shows its text instead.
 */
export async function bodyResponse(
	id: string,
	remoteImages: boolean,
	theme?: string | null,
): Promise<Response> {
	if (!messageIdSchema.safeParse(id).success) {
		return plain(404, "Not found");
	}
	try {
		const session = await currentMailSession();
		if (session === null) {
			return plain(401, "Unauthorized");
		}
		const email = await loadEmailRecord(session, id);
		const html = email === null ? null : rawBodies(email).html;
		if (html === null) {
			return plain(404, "Not found");
		}
		const { html: fragment } = sanitizeHtml(html, { remoteImages });
		return new Response(bodyDocument(fragment, theme), {
			status: 200,
			headers: bodyHeaders(remoteImages),
		});
	} catch (error) {
		logApiFailure("mail body", error);
		return plain(502, "Unavailable");
	}
}
