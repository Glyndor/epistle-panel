import { PUBLIC_ROUTES } from "../routes";

/**
 * Whether a request path is the person's own page, `/app/me` spelled exactly:
 * no decoding and no other case, and one slash at the end is the same route,
 * as the router reads it. Whatever else sits under `/app/me` (another case, an
 * encoded letter, a segment more) is no route, and the proxy hides it with the
 * panel's one 404 for a session. This module is pure, like `lib/mail-paths`.
 */
export function isMePath(requested: string): boolean {
	const pathname = requested.endsWith("/")
		? requested.slice(0, -1)
		: requested;
	return pathname === PUBLIC_ROUTES.me;
}
