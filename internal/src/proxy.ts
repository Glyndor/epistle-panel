import { type NextRequest, NextResponse } from "next/server";

import { captchaWideningFromEnv } from "./features/auth/captcha/config";
import { SESSION_COOKIE, verifySession } from "./lib/auth/session";
import { readAdminId } from "./lib/config/admin-id";
import {
	classifyAppPath,
	constantTimeEqual,
	isMailBodyPath,
	PUBLIC_ROUTES,
} from "./lib/routes";
import {
	applySecurityHeaders,
	buildCsp,
	CSP_HEADER,
	generateNonce,
} from "./lib/security-headers";

/**
 * The path the proxy rewrites every request to that no route of the panel
 * answers. Nothing matches it, so Next renders its 404 for it, and since every
 * such request ends up here, a path that does not exist, the admin area seen by
 * someone who may not see it, and `/app` itself all get the same body (the
 * nonce aside) and the same headers. If each kept its own path, the page's own
 * payload, which names the path it answered, would tell them apart.
 *
 * A request for this path itself is let on, as it is the very request a rewrite
 * makes. Next rewrites in-process when the rewritten URL has the host the
 * request came with, but sends it over the network when they differ (a request
 * to `127.0.0.1` is read as `localhost`), and that second request comes back
 * through the proxy: rewriting it to this path again would be a loop.
 */
export const HIDDEN_PATH = "/__not-found__";

/**
 * Gate the panel (Next 16 proxy convention) and stamp the security headers on
 * every response it emits. Only four things get on to the router: the sign-in
 * page at `/`, `/app/mail` for a session of any role (a visitor without one is
 * sent to the sign-in page), the admin area, which passes only when the first
 * segment after `/app` is the configured admin id and the session is valid and
 * carries the admin role, and the assets the matcher skips. Every other request
 * (a path no route answers, `/app` itself, no session, a user session, another
 * id, no id configured) is rewritten to {@link HIDDEN_PATH}, so it is the 404 of
 * a path that does not exist and never a redirect that would confirm an admin
 * area exists. Fail-closed: a missing signing secret, a forged or expired
 * cookie, or an unreadable id all resolve to "hidden". Each page and Server
 * Action checks the role again itself.
 *
 * The admin decision evaluates the session and the id comparison every time,
 * so its time does not tell which part was wrong. A redirect target is the
 * request's own origin with a fixed path and no query. Next rewrites a
 * same-origin `Location` into a relative one before it is sent, so a `Host` or
 * `X-Forwarded-Host` a client chose never reaches the wire (see
 * `scripts/headers/verify.sh`, which asserts it on a real server).
 */
export async function proxy(request: NextRequest) {
	const nonce = generateNonce();
	const { pathname } = request.nextUrl;
	const area = classifyAppPath(pathname);
	// The CAPTCHA provider's hosts are added to the sign-in page's policy and to
	// no other response: its widget loads there only.
	const csp = buildCsp(
		nonce,
		process.env.NODE_ENV === "development",
		area.kind === "root" ? captchaWideningFromEnv() : undefined,
	);

	const session =
		area.kind === "mail" || area.kind === "admin"
			? await verifySession(request.cookies.get(SESSION_COOKIE)?.value)
			: null;
	const adminId = area.kind === "admin" ? await readAdminId() : undefined;
	const isAdminArea =
		area.kind === "admin" &&
		constantTimeEqual(area.segment, adminId ?? "") &&
		adminId !== undefined &&
		session?.role === "admin";

	let response: NextResponse;
	if (
		pathname === HIDDEN_PATH ||
		area.kind === "root" ||
		isAdminArea ||
		(area.kind === "mail" && session)
	) {
		// Next reads the nonce from the request's CSP header and stamps it on
		// the inline scripts it renders.
		const requestHeaders = new Headers(request.headers);
		requestHeaders.set(CSP_HEADER, csp);
		response = NextResponse.next({ request: { headers: requestHeaders } });
	} else if (area.kind === "mail") {
		const url = request.nextUrl.clone();
		url.pathname = PUBLIC_ROUTES.root;
		url.search = "";
		response = NextResponse.redirect(url);
	} else {
		// The request's own origin, which Next treats as an internal rewrite (a
		// URL built from another host name is proxied as an external one), with
		// the fixed path and no query: nothing of the hidden request survives.
		const url = request.nextUrl.clone();
		url.pathname = HIDDEN_PATH;
		url.search = "";
		const requestHeaders = new Headers(request.headers);
		requestHeaders.set(CSP_HEADER, csp);
		response = NextResponse.rewrite(url, {
			request: { headers: requestHeaders },
		});
	}
	// The framed body of a message sends its own headers from its route, so the
	// panel's (which forbid framing) are not laid over them. Only a session
	// reaches it; the redirect and the hidden 404 keep the panel's headers.
	if (!(area.kind === "mail" && session && isMailBodyPath(pathname))) {
		applySecurityHeaders(response.headers, csp);
	}
	return response;
}

export const config = {
	// Everything except Next internals, static assets, `/robots.txt` and the
	// operator's public assets (`/theme.css`, `/brand/logo`, `/brand/favicon`).
	// The matcher is wide on purpose: every page, public or not, must receive
	// the nonce-bearing CSP. What needs a session is decided in the function
	// above (`classifyAppPath`), not here. The skipped names are
	// anchored: an unanchored `_next/image` or an unescaped dot in `favicon.ico`
	// would also skip `/_next/imagex` and `/faviconxico`, which belong behind
	// the gate. `robots.txt` is skipped as that exact path only, so a crawler
	// reads `Disallow: /` without a session; `next.config.ts` still stamps its
	// headers, `X-Robots-Tag` included. The theme and brand assets are skipped as
	// those exact paths for the same reason: the sign-in page needs them before
	// any session, and they open nothing else.
	//
	// `/app/mail/upload` is skipped as that exact path for another reason: the
	// proxy buffers the body of what it covers, and a file of 25 MiB must not be
	// held in memory for a request nobody has checked yet. Its route is then its
	// only gate, and does every check itself before it reads a byte: same origin,
	// the session and its role, the declared size (`uploadResponse`).
	matcher: [
		"/((?!_next/static/|_next/image$|favicon\\.ico$|robots\\.txt$|theme\\.css$|brand/logo$|brand/favicon$|app/mail/upload$).*)",
	],
};
