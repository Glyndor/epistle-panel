"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { verifyCredentials } from "@/lib/api/client";
import {
	createSession,
	SESSION_COOKIE,
	SESSION_MAX_AGE_SECONDS,
} from "@/lib/auth/session";

/** State returned by the {@link login} action to its form. */
export interface LoginState {
	/** Whether the last attempt failed (bad credentials or not an admin). */
	error: boolean;
}

/**
 * Verify submitted credentials against the mail server and, if they belong to
 * a panel admin, establish the session cookie and redirect into the panel. Any
 * failure — bad credentials, a non-admin account, or an unreachable server —
 * returns the same generic error, never revealing which.
 */
export async function login(
	_previous: LoginState,
	formData: FormData,
): Promise<LoginState> {
	const name = String(formData.get("name") ?? "").trim();
	const password = String(formData.get("password") ?? "");
	if (!name || !password) {
		return { error: true };
	}

	let result: { valid: boolean; admin: boolean };
	try {
		result = await verifyCredentials(name, password);
	} catch {
		return { error: true };
	}
	if (!result.valid || !result.admin) {
		return { error: true };
	}

	const store = await cookies();
	store.set(SESSION_COOKIE, await createSession(name), {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "lax",
		path: "/",
		maxAge: SESSION_MAX_AGE_SECONDS,
	});
	redirect("/");
}

/** Clear the session cookie and return to the login page. */
export async function logout(): Promise<void> {
	const store = await cookies();
	store.delete(SESSION_COOKIE);
	redirect("/login");
}
