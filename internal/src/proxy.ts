import { type NextRequest, NextResponse } from "next/server";

import { captchaWideningFromEnv } from "./features/auth/captcha/config";
import { SESSION_COOKIE, verifySession } from "./lib/auth/session";
import { isSessionPath, PUBLIC_ROUTES } from "./lib/routes";
import {
	applySecurityHeaders,
	buildCsp,
	CSP_HEADER,
	generateNonce,
} from "./lib/security-headers";

/** Whether a path is the login route, the only page outside `/app` that draws a form. */
function isLoginPath(pathname: string): boolean {
	return (
		pathname === PUBLIC_ROUTES.login ||
		pathname === `${PUBLIC_ROUTES.login}/`
	);
}

/**
 * Gate the signed-in area, `/app` and everything under it (Next 16 proxy
 * convention), behind a valid admin session, and stamp the security headers on
 * every response it emits. Without a session the request is redirected to the
 * login page. Fail-closed: a missing signing secret or a forged/expired cookie
 * all resolve to "no session". Outside `/app` nothing needs a session: the
 * login page, the root that sends the visitor to `/app`, and the paths no
 * route answers. Each Server Action still checks the session itself.
 *
 * The redirect target is the request's own origin with a fixed path and no
 * query. Next rewrites a same-origin `Location` into a relative one before it
 * is sent, so a `Host` or `X-Forwarded-Host` a client chose never reaches the
 * wire (see `scripts/headers/verify.sh`, which asserts it on a real server).
 */
export async function proxy(request: NextRequest) {
	const nonce = generateNonce();
	const onLoginPage = isLoginPath(request.nextUrl.pathname);
	// The CAPTCHA provider's hosts are added to the sign-in page's policy and to
	// no other response: its widget loads there only.
	const csp = buildCsp(
		nonce,
		process.env.NODE_ENV === "development",
		onLoginPage ? captchaWideningFromEnv() : undefined,
	);

	const allowed =
		!isSessionPath(request.nextUrl.pathname) ||
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
		url.pathname = PUBLIC_ROUTES.login;
		url.search = "";
		response = NextResponse.redirect(url);
	}
	applySecurityHeaders(response.headers, csp);
	return response;
}

export const config = {
	// Everything except Next internals, static assets, `/robots.txt` and the
	// operator's public assets (`/theme.css`, `/brand/logo`, `/brand/favicon`).
	// The matcher is wide on purpose: every page, public or not, must receive
	// the nonce-bearing CSP. What needs a session is decided in the function
	// above (`isSessionPath`), not here. The skipped names are
	// anchored: an unanchored `_next/image` or an unescaped dot in `favicon.ico`
	// would also skip `/_next/imagex` and `/faviconxico`, which belong behind
	// the gate. `robots.txt` is skipped as that exact path only, so a crawler
	// reads `Disallow: /` without a session; `next.config.ts` still stamps its
	// headers, `X-Robots-Tag` included. The theme and brand assets are skipped as
	// those exact paths for the same reason: the sign-in page needs them before
	// any session, and they open nothing else.
	matcher: [
		"/((?!_next/static/|_next/image$|favicon\\.ico$|robots\\.txt$|theme\\.css$|brand/logo$|brand/favicon$).*)",
	],
};
