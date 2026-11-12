import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { SESSION_COOKIE, verifySession } from "../session";

/**
 * Require a valid admin session in a Server Component page and return it.
 * Without one it redirects to the login page, which stops the render before the
 * page calls the API. The proxy gates the same routes; this is the second
 * check, for a route the proxy matcher does not cover. A page cannot answer a
 * bare 401 without an experimental Next flag, so a redirect is the denial.
 */
export async function requireSession(): Promise<{ sub: string }> {
	const session = await verifySession(
		(await cookies()).get(SESSION_COOKIE)?.value,
	);
	if (!session) {
		redirect("/login");
	}
	return session;
}
