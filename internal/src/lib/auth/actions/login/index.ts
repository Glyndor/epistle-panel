"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { verifyCredentials } from "@/lib/api/client";
import { holdUntilFloor } from "@/lib/auth/failure-floor";
import { admitAttempt, recordSuccess } from "@/lib/auth/login-limiter";
import {
	createSession,
	SESSION_COOKIE,
	SESSION_COOKIE_OPTIONS,
} from "@/lib/auth/session";

/** State returned by the {@link login} action to its form. */
export interface LoginState {
	/** Whether the last attempt failed (bad credentials or not an admin). */
	error: boolean;
	/** Whether the attempt was refused by the limiter before reaching the API. */
	throttled?: boolean;
}

/**
 * Verify submitted credentials against the mail server and, if they belong to
 * a panel admin, establish the session cookie and redirect into the panel. Any
 * failure — bad credentials, a non-admin account, an unreachable server or a
 * refused attempt — takes the same minimum time and returns an error, so the
 * response does not reveal which accounts exist. The limiter runs first: a
 * refused attempt never reaches the API. Only `throttled` tells a refusal apart,
 * and it applies to any name, existing or not.
 */
export async function login(
	_previous: LoginState,
	formData: FormData,
): Promise<LoginState> {
	const startedAt = Date.now();
	const fail = async (throttled = false): Promise<LoginState> => {
		await holdUntilFloor(startedAt);
		return throttled ? { error: true, throttled } : { error: true };
	};

	const name = String(formData.get("name") ?? "").trim();
	const password = String(formData.get("password") ?? "");
	if (!name || !password) {
		return fail();
	}
	if (!admitAttempt(name).allowed) {
		return fail(true);
	}

	let result: { valid: boolean; admin: boolean };
	try {
		result = await verifyCredentials(name, password);
	} catch {
		return fail();
	}
	if (!result.valid || !result.admin) {
		return fail();
	}

	recordSuccess(name);
	const store = await cookies();
	store.set(
		SESSION_COOKIE,
		await createSession(name),
		SESSION_COOKIE_OPTIONS,
	);
	redirect("/");
}
