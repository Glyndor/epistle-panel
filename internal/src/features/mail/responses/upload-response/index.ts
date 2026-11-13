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

function answer(status: number, body: unknown): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: {
			"Content-Type": "application/json",
			"Cache-Control": "private, no-store",
			"X-Content-Type-Options": "nosniff",
		},
	});
}

/**
 * `POST /app/mail/upload?name=`: store one attachment in epistle's blob store for
 * the account and answer its blob id. The body is the file itself. Same origin
 * and session first; the size is refused from `Content-Length` and counted as it
 * streams (never buffered past the cap by the panel: it is forwarded as it comes
 * only after the length is known, so the declared size is required); the name is
 * cleaned and the type is the declared one when it has the plain `type/subtype`
 * form, else `application/octet-stream`.
 */
export async function uploadResponse(request: Request): Promise<Response> {
	if (!isSameOrigin(request)) {
		return answer(403, { ok: false, reason: "forbidden" });
	}
	try {
		const session = await currentMailSession();
		if (session === null) {
			return answer(401, { ok: false, reason: "unauthenticated" });
		}
		const declared = Number(request.headers.get("content-length"));
		if (!Number.isFinite(declared) || declared <= 0) {
			return answer(411, { ok: false, reason: "invalid" });
		}
		if (declared > MAX_UPLOAD_BYTES) {
			return answer(413, { ok: false, reason: "tooLarge" });
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

		const bytes = new Uint8Array(await request.arrayBuffer());
		if (bytes.byteLength === 0 || bytes.byteLength > MAX_UPLOAD_BYTES) {
			return answer(bytes.byteLength === 0 ? 400 : 413, {
				ok: false,
				reason: bytes.byteLength === 0 ? "invalid" : "tooLarge",
			});
		}
		const signal = AbortSignal.timeout(BLOB_TIMEOUT_MS);
		const response = await fetch(
			`${apiBaseUrl()}/jmap/upload/${encodeURIComponent(session.accountId)}`,
			{
				method: "POST",
				headers: {
					Authorization: `Bearer ${session.bearer}`,
					"Content-Type": type,
				},
				body: bytes,
				cache: "no-store",
				redirect: "error",
				signal,
			},
		);
		if (response.status === 413 || response.status === 507) {
			await response.body?.cancel();
			return answer(413, { ok: false, reason: "tooLarge" });
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
		logApiFailure("mail upload", error);
		return answer(502, { ok: false, reason: "unavailable" });
	}
}
