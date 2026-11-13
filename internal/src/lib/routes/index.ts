import type { Route } from "next";

/**
 * The paths of the signed-in screens, in one place so a link, a redirect and a
 * navigation entry cannot drift apart. Everything that needs a session lives
 * under `/app`; outside it only the sign-in page and the public assets answer
 * without one.
 */
export const ROUTES = {
	suppression: "/app/suppression",
	deliveries: "/app/deliveries",
} as const;

/** The pages that have not moved under `/app` yet; each goes into {@link ROUTES} when it does. */
export const LEGACY_ROUTES = {
	accounts: "/accounts" as Route,
} as const;

/** The detail page of one account; `name` must already be a valid account name. */
export function accountDetailPath(name: string): Route {
	return `/app/accounts/${name}` as Route;
}
