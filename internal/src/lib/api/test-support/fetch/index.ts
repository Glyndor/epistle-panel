import { mock } from "bun:test";

/** Replace global `fetch` with one returning `body` as JSON at `status`. */
export function stubFetchJson(body: unknown, status = 200): void {
	globalThis.fetch = mock(
		async () =>
			new Response(JSON.stringify(body), {
				status,
				headers: { "content-type": "application/json" },
			}),
	) as unknown as typeof fetch;
}

/** Replace global `fetch` with one that rejects, simulating an unreachable API. */
export function stubFetchReject(): void {
	globalThis.fetch = mock(async () => {
		throw new TypeError("network error");
	}) as unknown as typeof fetch;
}

/** Replace global `fetch` with one answering `response`, whatever the request. */
export function stubFetchResponse(response: Response): void {
	globalThis.fetch = mock(async () => response) as unknown as typeof fetch;
}

/** Reject with the signal's reason once `signal` aborts, like a real `fetch`. */
function abortReason(signal: AbortSignal | null | undefined): Promise<never> {
	return new Promise((_, reject) => {
		signal?.addEventListener("abort", () => reject(signal.reason));
	});
}

/**
 * Replace global `fetch` with one that never answers, rejecting only when the
 * request's `AbortSignal` fires. A call made without a signal hangs forever.
 */
export function stubFetchHang(): void {
	globalThis.fetch = mock((_url: unknown, init?: RequestInit) =>
		abortReason(init?.signal),
	) as unknown as typeof fetch;
}

/**
 * Replace global `fetch` with one that answers its headers at once and then
 * never sends a body byte, erroring the body stream when the signal aborts.
 */
export function stubFetchStalledBody(): void {
	globalThis.fetch = mock(async (_url: unknown, init?: RequestInit) => {
		const body = new ReadableStream<Uint8Array>({
			start(controller) {
				init?.signal?.addEventListener("abort", () =>
					controller.error(init.signal?.reason),
				);
			},
		});
		return new Response(body, { status: 200 });
	}) as unknown as typeof fetch;
}

/** What a lazily generated body has done so far: chunks produced, and whether it was cancelled. */
export type ChunkCounter = { pulled: number; cancelled?: boolean };

/**
 * A body of `chunks` chunks of `chunkBytes` zero bytes, produced on demand.
 * `counter.pulled` shows how much of it a reader actually consumed.
 */
export function zeroStream(
	chunks: number,
	chunkBytes: number,
	counter: ChunkCounter,
): ReadableStream<Uint8Array> {
	return new ReadableStream<Uint8Array>({
		pull(controller) {
			if (counter.pulled >= chunks) {
				controller.close();
				return;
			}
			counter.pulled += 1;
			controller.enqueue(new Uint8Array(chunkBytes));
		},
		cancel() {
			counter.cancelled = true;
		},
	});
}
