import { apiError, json } from "./responses";

/**
 * The global suppression list at the start, sorted by byte order as the real
 * API sorts it. One address holds a `/` and one a `+`, so the checks show they
 * travel percent-encoded in the path and in the query.
 */
export const SEED_SUPPRESSED = [
	"alpha@example.test",
	"bounce+tag@example.test",
	"odd/one@example.test",
	"uno@ejemplo.test",
	"zeta@example.test",
];

/** Addresses per page when the caller gives no `limit`. */
const DEFAULT_PAGE = 2;

/** The page ceiling of the real API. */
const MAX_LIMIT = 100;

/**
 * The suppression endpoints, as `epistle` answers them: `GET
 * /api/v1/suppression` pages by an `after` cursor (addresses strictly after
 * it), and `DELETE /api/v1/suppression/{address}` answers 200 for an address
 * that is not on the list. Only the global list is modelled: a call that names
 * an `account` is answered 404.
 */
export function createSuppressionStore() {
	let list = [...SEED_SUPPRESSED];

	function page(url: URL): Response {
		if (url.searchParams.has("account")) {
			return apiError(404, "not_found", "no such account");
		}
		const requested = url.searchParams.get("limit");
		const limit = Math.min(
			requested === null ? DEFAULT_PAGE : Number(requested),
			MAX_LIMIT,
		);
		if (!(limit >= 1)) {
			return apiError(400, "invalid_input", "limit must be at least 1");
		}
		const after = url.searchParams.get("after");
		const start = after === null ? 0 : list.filter((a) => a <= after).length;
		const addresses = list.slice(start, start + limit);
		const more = start + addresses.length < list.length;
		return json({
			addresses,
			...(more ? { next_cursor: addresses[addresses.length - 1] } : {}),
		});
	}

	return {
		reset() {
			list = [...SEED_SUPPRESSED];
		},
		/** Answer a suppression request, or `undefined` when the path is not one. */
		handle(request: Request, url: URL): Response | undefined {
			if (url.pathname === "/api/v1/suppression") {
				return request.method === "GET" ? page(url) : undefined;
			}
			const target = /^\/api\/v1\/suppression\/([^/]+)$/.exec(url.pathname);
			if (target && request.method === "DELETE") {
				if (url.searchParams.has("account")) {
					return apiError(404, "not_found", "no such account");
				}
				const address = decodeURIComponent(target[1] ?? "");
				list = list.filter((other) => other !== address);
				return json({ removed: address });
			}
			return undefined;
		},
	};
}
