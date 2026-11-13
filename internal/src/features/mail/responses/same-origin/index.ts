/**
 * Whether a request comes from the panel's own pages. A browser always sends
 * `Origin` on a cross-site POST, so a missing or different one is refused. The
 * host to compare with is the one the proxy forwards, as Next does for Server
 * Actions (see `docs/maintainers/e2e.md`, "Origin check of Server Actions").
 */
export function isSameOrigin(request: Request): boolean {
	const origin = request.headers.get("origin");
	if (origin === null || origin === "null") {
		return false;
	}
	const host =
		request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
		request.headers.get("host");
	try {
		return host !== null && new URL(origin).host === host;
	} catch {
		return false;
	}
}
