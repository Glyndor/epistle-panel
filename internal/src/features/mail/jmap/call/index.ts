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

/** A downloaded blob: its octets and the type the server recorded for it. */
export interface BlobData {
	readonly bytes: Uint8Array;
	readonly type: string;
}

/** Read a body through a byte cap, cancelling the stream the moment it is crossed. */
async function readCapped(
	response: Response,
	maxBytes: number,
): Promise<Uint8Array> {
	const declared = Number(response.headers.get("content-length"));
	if (Number.isFinite(declared) && declared > maxBytes) {
		await response.body?.cancel();
		throw new JmapError("shape", "blob too large");
	}
	const chunks: Uint8Array[] = [];
	let total = 0;
	const reader = response.body?.getReader();
	while (reader) {
		const { done, value } = await reader.read();
		if (done) {
			break;
		}
		total += value.byteLength;
		if (total > maxBytes) {
			await reader.cancel();
			throw new JmapError("shape", "blob too large");
		}
		chunks.push(value);
	}
	const bytes = new Uint8Array(total);
	let offset = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return bytes;
}

/**
 * Download one blob of the account, stopping at `maxBytes`. The name in the
 * URL is only a label to JMAP (the blob id decides), so a fixed one is sent.
 * Answers `notFound` for a 404 and `http` for any other refusal.
 */
export function downloadBlob(
	session: MailSession,
	blobId: string,
	maxBytes: number,
	timeoutMs: number = BLOB_TIMEOUT_MS,
): Promise<BlobData> {
	const path = `/jmap/download/${encodeURIComponent(session.accountId)}/${encodeURIComponent(blobId)}/blob`;
	return exchange(session, path, {}, timeoutMs, async (response) => {
		await requireOk(response);
		return {
			bytes: await readCapped(response, maxBytes),
			type: response.headers.get("content-type") ?? "",
		};
	});
}
