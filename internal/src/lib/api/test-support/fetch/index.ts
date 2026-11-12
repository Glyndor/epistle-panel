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
