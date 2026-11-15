import "server-only";

import { JmapError } from "@/features/mail/jmap/call";
import { currentMailSession } from "@/features/mail/jmap/credentials";
import { loadComposeLimits } from "@/features/mail/queries/compose-limits";
import { composeMessage } from "@/features/mail/queries/compose-message";
import { isSameOrigin } from "@/features/mail/responses/same-origin";
import { composeInputSchema } from "@/features/mail/schemas/compose-input";
import { logApiFailure } from "@/lib/api/log-failure";

/**
 * The policy of an answer of this route. The proxy does not cover it (see the
 * matcher in `proxy.ts`), so the route sends its own: the answer is JSON for a
 * script, and nothing may load or frame it.
 */
const ANSWER_POLICY = "default-src 'none'; frame-ancestors 'none'";

function answer(status: number, body: unknown): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: {
			"Content-Type": "application/json",
			"Cache-Control": "private, no-store",
			"X-Content-Type-Options": "nosniff",
			"Content-Security-Policy": ANSWER_POLICY,
		},
	});
}

/**
 * Read the body as it streams and stop at the first byte past `limit`, counting
 * bytes. A body longer than it declared, or than the cap, is `null` and the rest
 * is never read.
 */
async function readCapped(
	request: Request,
	limit: number,
	cap: number,
): Promise<string | null> {
	const reader = request.body?.getReader();
	if (reader === undefined) {
		return null;
	}
	const chunks: Uint8Array[] = [];
	let total = 0;
	for (;;) {
		const { done, value } = await reader.read();
		if (done) {
			break;
		}
		total += value.byteLength;
		if (total > limit || total > cap) {
			await reader.cancel();
			return null;
		}
		chunks.push(value);
	}
	const bytes = new Uint8Array(total);
	let offset = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return new TextDecoder().decode(bytes);
}

/**
 * `POST /app/mail/compose-message`: save a draft or send a message. A route handler and
 * not a Server Action because a message body is larger than the 16 KB a Server
 * Action may carry. Because it is a plain POST endpoint it does what an action
 * does and one thing more: the request must come from the panel's own origin,
 * then the session is checked, then a valid `Content-Length` is required (411) and the body is
 * read as it streams, cut at the first byte past the cap or past what was declared
 * (bytes, not characters), then parsed with the strict schema. The answer is a closed category, never the
 * server's words.
 *
 * The route is outside the proxy (see the matcher in `proxy.ts`): the proxy
 * buffers the body of what it covers, and a message may be as many bytes as the
 * mail server accepts. So the route is its own gate and does every check
 * itself before it reads a byte: same origin, the session and its role, the
 * declared size, and then the body as a stream.
 *
 * The cap is the one the mail server publishes (`maxSizeRequest`), so the route
 * refuses exactly what the server refuses and nothing it accepts.
 */
export async function composeResponse(request: Request): Promise<Response> {
	if (!isSameOrigin(request)) {
		return answer(403, { ok: false, reason: "forbidden" });
	}
	try {
		const session = await currentMailSession();
		if (session === null) {
			return answer(401, { ok: false, reason: "unauthenticated" });
		}
		if (
			!(request.headers.get("content-type") ?? "").startsWith(
				"application/json",
			)
		) {
			return answer(415, { ok: false, reason: "invalid" });
		}
		const declared = Number(request.headers.get("content-length"));
		if (!Number.isInteger(declared) || declared <= 0) {
			return answer(411, { ok: false, reason: "invalid" });
		}
		const limits = await loadComposeLimits(session);
		if (declared > limits.maxRequestBytes) {
			return answer(413, { ok: false, reason: "invalid" });
		}
		const text = await readCapped(
			request,
			declared,
			limits.maxRequestBytes,
		);
		if (text === null) {
			return answer(413, { ok: false, reason: "invalid" });
		}
		let body: unknown;
		try {
			body = JSON.parse(text);
		} catch {
			return answer(400, { ok: false, reason: "invalid" });
		}
		const parsed = composeInputSchema(limits).safeParse(body);
		if (!parsed.success) {
			if (
				parsed.error.issues.some(
					(issue) => issue.message === "tooLargeAttachments",
				)
			) {
				return answer(413, {
					ok: false,
					reason: "tooLargeAttachments",
					limit: limits.maxTotalAttachmentBytes,
				});
			}
			return answer(400, { ok: false, reason: "invalid" });
		}
		return answer(200, {
			ok: true,
			result: await composeMessage(session, parsed.data),
		});
	} catch (error) {
		if (
			error instanceof JmapError &&
			((error.failure === "http" && error.detail === "413") ||
				(error.failure === "method" &&
					error.detail === "requestTooLarge"))
		) {
			return answer(413, { ok: false, reason: "tooLarge" });
		}
		logApiFailure("mail compose", error);
		return answer(502, { ok: false, reason: "unavailable" });
	}
}
