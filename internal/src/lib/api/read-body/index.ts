import { EpistleApiResponseTooLargeError } from "../error";

/** Largest API response body the panel parses, in bytes. */
export const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;

/**
 * Read a response body as JSON without buffering more than `maxBytes`.
 *
 * A `content-length` over the cap is refused before any byte is read. Without
 * one, or with a header that understates the size, the stream is read through
 * a byte counter and cancelled the moment it crosses the cap, so memory use is
 * bounded by the cap plus one chunk whatever the server sends.
 *
 * Throws `EpistleApiResponseTooLargeError` over the cap and the usual
 * `SyntaxError` when the body is not JSON.
 */
export async function readJsonBody(
	response: Response,
	maxBytes: number = MAX_RESPONSE_BYTES,
): Promise<unknown> {
	const declared = Number(response.headers.get("content-length"));
	if (Number.isFinite(declared) && declared > maxBytes) {
		await response.body?.cancel();
		throw new EpistleApiResponseTooLargeError();
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
			throw new EpistleApiResponseTooLargeError();
		}
		chunks.push(value);
	}

	const bytes = new Uint8Array(total);
	let offset = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return JSON.parse(new TextDecoder().decode(bytes));
}
