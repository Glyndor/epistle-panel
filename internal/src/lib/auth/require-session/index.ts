import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { readAdminId } from "@/lib/config/admin-id";
import { type AdminRoutes, adminRoutes, PUBLIC_ROUTES } from "@/lib/routes";
import { SESSION_COOKIE, type SessionRole, verifySession } from "../session";

/**
 * Require a valid session of any role in a Server Component and return it.
 * Without one it redirects to the sign-in page, which stops the render before
 * the page calls the API. The proxy gates the same routes; this is the second
 * check, for a route the proxy matcher does not cover. A page cannot answer a
 * bare 401 without an experimental Next flag, so a redirect is the denial.
 */
export async function requireSession(): Promise<{
	sub: string;
	role: SessionRole;
}> {
	const session = await verifySession(
		(await cookies()).get(SESSION_COOKIE)?.value,
	);
	if (!session) {
		redirect(PUBLIC_ROUTES.root);
	}
	return session;
}

/**
 * Require a session with the admin role, in an installation whose admin area is
 * on, and return the account, the id and the admin paths. Anything else is the 404 of
 * a path that does not exist, not a redirect, so a page of the admin area never
 * confirms that an admin area exists to someone who is not an admin. Every admin
 * page calls this itself; the role is the one the signed token carries, so it
 * cannot be changed from the browser.
 */
export async function requireAdmin(): Promise<{
	sub: string;
	id: string;
	routes: AdminRoutes;
}> {
	const session = await verifySession(
		(await cookies()).get(SESSION_COOKIE)?.value,
	);
	const id = await readAdminId();
	if (session?.role !== "admin" || id === undefined) {
		notFound();
	}
	return { sub: session.sub, id, routes: adminRoutes(id) };
}
