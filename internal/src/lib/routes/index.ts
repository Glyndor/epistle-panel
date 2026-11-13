import type { Route } from "next";

/**
 * The paths of the signed-in screens, in one place so a link, a redirect and a
 * navigation entry cannot drift apart. Everything that needs a session lives
 * under `/app`; outside it only the sign-in page and the public assets answer
 * without one.
 */
export const ROUTES = {
	home: "/app",
	domains: "/app/domains",
	accounts: "/app/accounts",
	queue: "/app/queue",
	suppression: "/app/suppression",
	deliveries: "/app/deliveries",
} as const;

/**
 * The paths outside `/app`: the sign-in page, and the root, which only sends
 * the visitor on to {@link ROUTES.home}.
 */
export const PUBLIC_ROUTES = {
	root: "/",
	login: "/login",
} as const;

/** The detail page of one account; `name` must already be a valid account name. */
export function accountDetailPath(name: string): Route {
	return `${ROUTES.accounts}/${name}` as Route;
}

/**
 * Whether a request path belongs to the signed-in area, which is `/app` and
 * everything under it. The test is a superset on purpose: a path is read the
 * way a router may read it (percent-decoded, backslashes as slashes, repeated
 * slashes collapsed, any letter case, a `;` parameter dropped), and one that cannot be decoded counts
 * as inside, so a spelling the proxy and the router disagree on is gated
 * rather than let through.
 */
export function isSessionPath(pathname: string): boolean {
	let decoded: string;
	try {
		decoded = decodeURIComponent(pathname);
	} catch {
		return true;
	}
	const first = decoded
		.replaceAll("\\", "/")
		.split("/")
		.find((segment) => segment !== "");
	return first?.split(";")[0]?.toLowerCase() === "app";
}
