import { type NextRequest, NextResponse } from "next/server";

import { SESSION_COOKIE, verifySession } from "./lib/auth/session";

/**
 * Gate every panel route (Next 16 proxy convention) behind a valid admin session. Without one the request
 * is redirected to the login page. Fail-closed: a missing signing secret or a
 * forged/expired cookie all resolve to "no session".
 */
export async function proxy(request: NextRequest) {
	const session = await verifySession(
		request.cookies.get(SESSION_COOKIE)?.value,
	);
	if (session) {
		return NextResponse.next();
	}
	const url = request.nextUrl.clone();
	url.pathname = "/login";
	url.search = "";
	return NextResponse.redirect(url);
}

export const config = {
	// Everything except the login route, Next internals and static assets.
	matcher: ["/((?!login|_next/static|_next/image|favicon.ico).*)"],
};
