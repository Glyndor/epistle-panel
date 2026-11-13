import "server-only";

import { z } from "zod";

import { EpistleApiTimeoutError } from "@/lib/api/error";
import { readJsonBody } from "@/lib/api/read-body";
import { apiBaseUrl } from "@/lib/config/api-url";

import type { MailSession } from "../credentials";

/** Time budget of one JMAP request, in milliseconds. */
export const JMAP_TIMEOUT_MS = 10_000;

/** Time budget of a blob download, in milliseconds. */
export const BLOB_TIMEOUT_MS = 60_000;

/** The capabilities every request names. */
const USING = ["urn:ietf:params:jmap:core", "urn:ietf:params:jmap:mail"];

/** Why a JMAP call failed. Never carries what the server said, only a closed category. */
export type JmapFailure = "http" | "method" | "shape" | "notFound";

/** Raised when epistle's JMAP does not give a usable answer. */
export class JmapError extends Error {
	readonly failure: JmapFailure;
	/** The HTTP status for `http`, the JMAP error type for `method`. */
	readonly detail: string;

	constructor(failure: JmapFailure, detail: string) {
		super(`jmap ${failure}: ${detail}`);
		this.name = "JmapError";
		this.failure = failure;
		this.detail = detail;
	}
}

/** One JMAP method call: its name, its arguments and the id its answer carries. */
export type MethodCall = readonly [
	name: string,
	args: Record<string, unknown>,
	callId: string,
];

const envelopeSchema = z.object({
	methodResponses: z.array(
		z.tuple([z.string(), z.record(z.string(), z.unknown()), z.string()]),
	),
});

type MethodResponse = z.infer<typeof envelopeSchema>["methodResponses"][number];

/**
 * Fetch `path` with the session's bearer and let `handle` read the answer. The
 * whole exchange, headers and body, shares one time budget and a redirect is
 * refused (epistle never redirects, and following one would send the bearer
 * somewhere the configuration did not name).
 */
async function exchange<T>(
	session: MailSession,
	path: string,
	init: RequestInit,
	timeoutMs: number,
	handle: (response: Response) => Promise<T>,
): Promise<T> {
	const headers = new Headers(init.headers);
	headers.set("Authorization", `Bearer ${session.bearer}`);
	const signal = AbortSignal.timeout(timeoutMs);
	try {
		const response = await fetch(`${apiBaseUrl()}${path}`, {
			...init,
			headers,
			cache: "no-store",
			redirect: "error",
			signal,
		});
		return await handle(response);
	} catch (error) {
		if (signal.aborted) {
			throw new EpistleApiTimeoutError();
		}
		throw error;
	}
}

/** Refuse a non-2xx answer without reading its body. */
async function requireOk(response: Response): Promise<void> {
	if (response.status === 404) {
		await response.body?.cancel();
		throw new JmapError("notFound", "404");
	}
	if (!response.ok) {
		await response.body?.cancel();
		throw new JmapError("http", String(response.status));
	}
}

/**
 * Run `calls` as one JMAP request for `session` and return the method
 * responses in order. The request goes to `/jmap/api` with the session's
 * bearer; the body of the answer is read through the panel's byte cap. A
 * non-2xx answer is a `JmapError("http")`; an answer that is not a JMAP
 * response is a `JmapError("shape")`. A method that failed comes back as a
 * response named `error` for {@link methodResult} to turn into an error.
 */
export async function jmapCall(
	session: MailSession,
	calls: readonly MethodCall[],
	timeoutMs: number = JMAP_TIMEOUT_MS,
): Promise<MethodResponse[]> {
	const body = await exchange(
		session,
		"/jmap/api",
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Accept: "application/json",
			},
			body: JSON.stringify({ using: USING, methodCalls: calls }),
		},
		timeoutMs,
		async (response) => {
			await requireOk(response);
			return readJsonBody(response);
		},
	);
	const parsed = envelopeSchema.safeParse(body);
	if (!parsed.success) {
		throw new JmapError("shape", "envelope");
	}
	return parsed.data.methodResponses;
}

/**
 * The arguments of the response to call `callId`, checked against `schema`.
 * An `error` response, or one that is missing or named for another method,
 * throws: the caller never reads data that is not the data it asked for.
 */
export function methodResult<S extends z.ZodType>(
	responses: readonly MethodResponse[],
	callId: string,
	method: string,
	schema: S,
): z.output<S> {
	const response = responses.find(([, , id]) => id === callId);
	if (response === undefined) {
		throw new JmapError("shape", "missing response");
	}
	const [name, args] = response;
	if (name === "error") {
		const type =
			typeof args["type"] === "string" ? args["type"] : "unknown";
		throw new JmapError(
			"method",
			/^[A-Za-z]{1,40}$/.test(type) ? type : "unknown",
		);
	}
	if (name !== method) {
		throw new JmapError("shape", "unexpected method");
	}
	const parsed = schema.safeParse(args);
	if (!parsed.success) {
		throw new JmapError("shape", method);
	}
	return parsed.data;
}

/** A blob being downloaded: its octets as they arrive, the type the server recorded, and its size when the server declared one. */
export interface BlobStream {
	readonly body: ReadableStream<Uint8Array>;
	readonly type: string;
	/** `null` when the server sent no `Content-Length`. */
	readonly length: number | null;
}

/** Longest a blob download may stand still, in milliseconds: no octet from the server, or none asked for by the reader. */
export const BLOB_IDLE_MS = 30_000;

/** The declared size of an answer, or `null` when it declared none it can be held to. */
function declaredLength(response: Response): number | null {
	const header = response.headers.get("content-length");
	if (header === null || !/^\d{1,15}$/.test(header)) {
		return null;
	}
	return Number(header);
}

/**
 * Open one blob of the account as a stream, capped at `maxBytes`. Nothing of it
 * is kept here: an octet is read from the mail server when the reader asks for
 * one, so a file of any size costs one chunk of memory.
 *
 * The answer's headers have `timeoutMs` to arrive. From then on the download has
 * no total budget (the reader may be on a slow line) but may not stand still for
 * `idleMs`. A blob that declares more than the cap is refused before a byte is
 * passed on; one that carries more than the cap without saying so fails the
 * stream at that byte, so the reader sees a broken download and never a short
 * file that looks whole. A blob that declared a size is held to it, to the
 * byte: the size goes out as the `Content-Length` of the panel's own answer, so
 * a stream that carried more or fewer octets would put that answer out of step
 * with what follows it on the connection.
 *
 * The name in the URL is only a label to JMAP (the blob id decides), so a fixed
 * one is sent. Answers `notFound` for a 404 and `http` for any other refusal.
 */
export async function openBlob(
	session: MailSession,
	blobId: string,
	maxBytes: number,
	timeoutMs: number = BLOB_TIMEOUT_MS,
	idleMs: number = BLOB_IDLE_MS,
): Promise<BlobStream> {
	const path = `/jmap/download/${encodeURIComponent(session.accountId)}/${encodeURIComponent(blobId)}/blob`;
	const abort = new AbortController();
	let late = false;
	let timer = setTimeout(() => {
		late = true;
		abort.abort();
	}, timeoutMs);
	const allow = (ms: number) => {
		clearTimeout(timer);
		timer = setTimeout(() => abort.abort(), ms);
	};
	try {
		const response = await fetch(`${apiBaseUrl()}${path}`, {
			headers: { Authorization: `Bearer ${session.bearer}` },
			cache: "no-store",
			redirect: "error",
			signal: abort.signal,
		});
		await requireOk(response);
		const length = declaredLength(response);
		if (length !== null && length > maxBytes) {
			await response.body?.cancel();
			throw new JmapError("shape", "blob too large");
		}
		const type = response.headers.get("content-type") ?? "";
		const reader = response.body?.getReader();
		let total = 0;
		allow(idleMs);
		const body = new ReadableStream<Uint8Array>({
			async pull(controller) {
				try {
					const next = await reader?.read();
					if (next === undefined || next.done) {
						clearTimeout(timer);
						if (length !== null && total !== length) {
							controller.error(
								new JmapError(
									"shape",
									"blob shorter than declared",
								),
							);
							return;
						}
						controller.close();
						return;
					}
					total += next.value.byteLength;
					if (total > maxBytes) {
						clearTimeout(timer);
						await reader?.cancel();
						controller.error(
							new JmapError("shape", "blob too large"),
						);
						return;
					}
					// The declared size goes out as this answer's `Content-Length`,
					// so the stream is held to it: not a byte more is passed on.
					if (length !== null && total > length) {
						clearTimeout(timer);
						await reader?.cancel();
						controller.error(
							new JmapError("shape", "blob longer than declared"),
						);
						return;
					}
					allow(idleMs);
					controller.enqueue(next.value);
				} catch (error) {
					clearTimeout(timer);
					controller.error(error);
				}
			},
			cancel(reason) {
				clearTimeout(timer);
				return reader?.cancel(reason);
			},
		});
		return { body, type, length };
	} catch (error) {
		clearTimeout(timer);
		if (late) {
			throw new EpistleApiTimeoutError();
		}
		throw error;
	}
}
