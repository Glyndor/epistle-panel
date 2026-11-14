import { apiError, json } from "./responses";
import type { SampleQueued } from "./sample";

/** Entries the queue holds at the start, in the order the API lists them. */
const SEED_IDS = [
	"11111111-1111-4111-8111-111111111111",
	"22222222-2222-4222-8222-222222222222",
	"33333333-3333-4333-8333-333333333333",
	"44444444-4444-4444-8444-444444444444",
	"55555555-5555-4555-8555-555555555555",
];

/** Entries per queue page when the caller gives no `limit`. */
const DEFAULT_PAGE = 2;

const seed = (): SampleQueued[] =>
	SEED_IDS.map((id) => ({
		id,
		reverse_path: `sender-${id.slice(0, 1)}@example.test`,
		recipients: [`rcpt-${id.slice(0, 1)}@example.net`],
	}));

/**
 * The outbound queue, as `epistle` answers it: `GET /api/v1/queue` pages by a
 * cursor and `DELETE /api/v1/queue/{id}` removes one entry, 404 for an id that
 * is not there. The seed ids are version 4, which carry no time; a sample
 * (`use`) holds version 7 ids, as the real queue does.
 */
export function createQueueStore() {
	let queue = seed();

	function page(url: URL): Response {
		const limit = Number(url.searchParams.get("limit")) || DEFAULT_PAGE;
		const cursor = url.searchParams.get("cursor");
		const start =
			cursor === null ? 0 : queue.findIndex((entry) => entry.id === cursor);
		if (start < 0) {
			return apiError(400, "bad_cursor", "Unknown cursor");
		}
		const next = queue[start + limit];
		return json({
			entries: queue.slice(start, start + limit),
			...(next === undefined ? {} : { next_cursor: next.id }),
		});
	}

	return {
		reset() {
			queue = seed();
		},
		/** Replace the queue with a sample's entries until the next reset. */
		use(entries: SampleQueued[]) {
			queue = entries;
		},
		size: () => queue.length,
		/** Answer a queue request, or `undefined` when the path is not one. */
		handle(request: Request, url: URL): Response | undefined {
			if (url.pathname === "/api/v1/queue" && request.method === "GET") {
				return page(url);
			}
			const removal = /^\/api\/v1\/queue\/([^/]+)$/.exec(url.pathname);
			if (removal && request.method === "DELETE") {
				const id = decodeURIComponent(removal[1] ?? "");
				if (!queue.some((entry) => entry.id === id)) {
					return apiError(404, "not_found", "No such queue entry");
				}
				queue = queue.filter((entry) => entry.id !== id);
				return json({ removed: id });
			}
			return undefined;
		},
	};
}
