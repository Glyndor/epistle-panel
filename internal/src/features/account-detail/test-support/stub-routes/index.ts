import { mock } from "bun:test";

/** One canned answer: a status and a JSON body, or a function that makes them. */
export type Answer = { status?: number; body: unknown };
type Route = [method: string, pattern: RegExp, answer: Answer | (() => Answer)];

/**
 * Replace global `fetch` with one that answers by method and path, so a page
 * made of several queries and mutations can be driven against one stub. The
 * first matching route wins; a request no route matches answers a 404 API
 * error, which is what the real server does for a path it does not know. The
 * stub is a Bun mock, so `sentRequests()` reads what was sent.
 */
export function stubRoutes(routes: readonly Route[]): void {
	globalThis.fetch = mock(async (input: string | URL, init?: RequestInit) => {
		const url = new URL(String(input));
		const method = init?.method ?? "GET";
		const hit = routes.find(
			([m, pattern]) => m === method && pattern.test(url.pathname),
		);
		const answer = hit
			? typeof hit[2] === "function"
				? hit[2]()
				: hit[2]
			: {
					status: 404,
					body: { error: { code: "not_found", message: "no route" } },
				};
		return new Response(JSON.stringify(answer.body), {
			status: answer.status ?? 200,
			headers: { "content-type": "application/json" },
		});
	}) as unknown as typeof fetch;
}
