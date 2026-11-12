import { type NextRequest, NextResponse } from "next/server";

import { SESSION_COOKIE, verifySession } from "./lib/auth/session";
import {
	applySecurityHeaders,
	buildCsp,
	CSP_HEADER,
	generateNonce,
} from "./lib/security-headers";

/** Whether a path is the login route, the only one reachable without a session. */
function isLoginPath(pathname: string): boolean {
	return pathname === "/login" || pathname === "/login/";
}

/**
 * Gate every panel route (Next 16 proxy convention) behind a valid admin
 * session, and stamp the security headers on every response it emits. Without
 * a session the request is redirected to the login page. Fail-closed: a
 * missing signing secret or a forged/expired cookie all resolve to "no
 * session".
 *
 * The redirect target is the request's own origin with a fixed path and no
 * query. Next rewrites a same-origin `Location` into a relative one before it
 * is sent, so a `Host` or `X-Forwarded-Host` a client chose never reaches the
 * wire (see `scripts/headers/verify.sh`, which asserts it on a real server).
 */
export async function proxy(request: NextRequest) {
	const nonce = generateNonce();
	const csp = buildCsp(nonce, process.env.NODE_ENV === "development");

	const allowed =
		isLoginPath(request.nextUrl.pathname) ||
		(await verifySession(request.cookies.get(SESSION_COOKIE)?.value)) !==
			null;

	let response: NextResponse;
	if (allowed) {
		// Next reads the nonce from the request's CSP header and stamps it on
		// the inline scripts it renders.
		const requestHeaders = new Headers(request.headers);
		requestHeaders.set(CSP_HEADER, csp);
		response = NextResponse.next({ request: { headers: requestHeaders } });
	} else {
		const url = request.nextUrl.clone();
		url.pathname = "/login";
		url.search = "";
		response = NextResponse.redirect(url);
	}
	applySecurityHeaders(response.headers, csp);
	return response;
}

export const config = {
	// Everything except Next internals, static assets and `/robots.txt`. The
	// login route stays inside the matcher so it receives the nonce-bearing CSP;
	// the proxy itself lets it through without a session. The skipped names are
	// anchored: an unanchored `_next/image` or an unescaped dot in `favicon.ico`
	// would also skip `/_next/imagex` and `/faviconxico`, which belong behind
	// the gate. `robots.txt` is skipped as that exact path only, so a crawler
	// reads `Disallow: /` without a session; `next.config.ts` still stamps its
	// headers, `X-Robots-Tag` included.
	matcher: [
		"/((?!_next/static/|_next/image$|favicon\\.ico$|robots\\.txt$).*)",
	],
};
