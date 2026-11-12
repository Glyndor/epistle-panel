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
