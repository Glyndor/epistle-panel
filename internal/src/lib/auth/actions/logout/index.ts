"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
	revokeSession,
	SESSION_COOKIE,
	SESSION_COOKIE_OPTIONS,
} from "@/lib/auth/session";

/**
 * Revoke the session token, expire the cookie and return to the login page.
 * The cookie is expired with the same attributes it was set with, because a
 * browser ignores a `__Host-` cookie that arrives without `Secure` and `Path=/`.
 */
export async function logout(): Promise<void> {
	const store = await cookies();
	await revokeSession(store.get(SESSION_COOKIE)?.value);
	store.set(SESSION_COOKIE, "", { ...SESSION_COOKIE_OPTIONS, maxAge: 0 });
	redirect("/login");
}
