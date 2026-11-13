import "server-only";

import { z } from "zod";

import { BLOB_TIMEOUT_MS } from "@/features/mail/jmap/call";
import { currentMailSession } from "@/features/mail/jmap/credentials";
import { isSameOrigin } from "@/features/mail/responses/same-origin";
import { safeFilename } from "@/features/mail/sanitize/safe-filename";
import { mediaTypeSchema } from "@/features/mail/schemas/compose-input";
import { logApiFailure } from "@/lib/api/log-failure";
import { readJsonBody } from "@/lib/api/read-body";
import { apiBaseUrl } from "@/lib/config/api-url";

/** Largest attachment the panel uploads, in bytes: epistle's message size cap, 25 MiB. */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

const uploadedSchema = z.object({ blobId: z.string(), size: z.number() });

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
 * Pass a body on as it comes, counting it against the size that was declared
 * and checked. One chunk is read when the mail server asks for one, so nothing
 * piles up here. The stream fails the moment a byte past that size arrives, and
 * at its end when fewer came, and `mismatch` then says so: what is handed on is
 * never more than was checked.
 */
function counted(
	body: ReadableStream<Uint8Array>,
	declared: number,
	mismatch: { found: boolean },
): ReadableStream<Uint8Array> {
	const reader = body.getReader();
	let seen = 0;
	return new ReadableStream<Uint8Array>({
		async pull(controller) {
			const { done, value } = await reader.read();
			if (done) {
				if (seen === declared) {
					controller.close();
				} else {
					mismatch.found = true;
					controller.error(new Error("body shorter than declared"));
				}
				return;
			}
			seen += value.byteLength;
			if (seen > declared) {
				mismatch.found = true;
				await reader.cancel();
				controller.error(new Error("body longer than declared"));
				return;
			}
			controller.enqueue(value);
		},
		cancel(reason) {
			return reader.cancel(reason);
		},
	});
}

/**
 * `POST /app/mail/upload?name=`: store one attachment in epistle's blob store for
 * the account and answer its blob id. The body is the file itself.
 *
 * This route is the only gate of its path: the proxy skips it, because the proxy
 * holds in memory the body of everything it covers. So every check is here and
 * comes before a byte of the body is read: same origin, the session and its
 * role, and the size from `Content-Length`, which is required. The body is then
 * handed to the mail server as it arrives, counted against that size, and is
 * never buffered by the panel. The name is cleaned and the type is the declared
 * one when it has the plain `type/subtype` form, else
 * `application/octet-stream`.
 */
export async function uploadResponse(request: Request): Promise<Response> {
	if (!isSameOrigin(request)) {
		return answer(403, { ok: false, reason: "forbidden" });
	}
	const mismatch = { found: false };
	try {
		const session = await currentMailSession();
		if (session === null) {
			return answer(401, { ok: false, reason: "unauthenticated" });
		}
		const declared = Number(request.headers.get("content-length"));
		if (!Number.isInteger(declared) || declared <= 0) {
			return answer(411, { ok: false, reason: "invalid" });
		}
		if (declared > MAX_UPLOAD_BYTES) {
			return answer(413, { ok: false, reason: "tooLarge" });
		}
		if (request.body === null) {
			return answer(400, { ok: false, reason: "invalid" });
		}
		const given =
			request.headers
				.get("content-type")
				?.split(";")[0]
				?.trim()
				.toLowerCase() ?? "";
		const type = mediaTypeSchema.safeParse(given).success
			? given
			: "application/octet-stream";
		const name = safeFilename(
			new URL(request.url).searchParams.get("name"),
		);

		const signal = AbortSignal.timeout(BLOB_TIMEOUT_MS);
		const response = await fetch(
			`${apiBaseUrl()}/jmap/upload/${encodeURIComponent(session.accountId)}`,
			{
				method: "POST",
				headers: {
					Authorization: `Bearer ${session.bearer}`,
					"Content-Type": type,
					// The length that was checked: the mail server reads exactly this
					// much, and the call fails if the stream gives another amount.
					"Content-Length": String(declared),
				},
				body: counted(request.body, declared, mismatch),
				// A streamed request body has to say it does not wait for the answer.
				duplex: "half",
				cache: "no-store",
				redirect: "error",
				signal,
			} as RequestInit,
		);
		if (response.status === 413 || response.status === 507) {
			await response.body?.cancel();
			return answer(413, { ok: false, reason: "tooLarge" });
		}
		if (response.status === 429) {
			// The mail server takes a few uploads at a time for one caller.
			await response.body?.cancel();
			return answer(429, { ok: false, reason: "busy" });
		}
		if (!response.ok) {
			await response.body?.cancel();
			throw new Error(`upload refused: ${response.status}`);
		}
		const stored = uploadedSchema.parse(await readJsonBody(response));
		return answer(200, {
			ok: true,
			attachment: {
				blobId: stored.blobId,
				size: stored.size,
				type,
				name,
			},
		});
	} catch (error) {
		if (mismatch.found) {
			// The body was not the size it declared: the call to the mail server
			// broke off, and nothing was stored.
			return answer(400, { ok: false, reason: "invalid" });
		}
		logApiFailure("mail upload", error);
		return answer(502, { ok: false, reason: "unavailable" });
	}
}
