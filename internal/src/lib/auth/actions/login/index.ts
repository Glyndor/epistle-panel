"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { verifyCredentials } from "@/lib/api/client";
import { admitAttempt } from "@/lib/auth/login-limiter";
import { holdUntilFloor } from "@/lib/auth/response-floor";
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
 * a panel admin, establish the session cookie and redirect into the panel.
 * Every outcome, success included, takes the same minimum time (see
 * `response-floor`), and a failure returns the same error whatever its cause,
 * so the response does not reveal which accounts exist. The limiter runs first:
 * a refused attempt never reaches the API. Only `throttled` tells a refusal
 * apart, and it applies to any name, existing or not.
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
	const admission = admitAttempt(name);
	if (!admission.allowed) {
		return fail(true);
	}

	let result: { valid: boolean; admin: boolean };
	try {
		result = await verifyCredentials(name, password);
	} catch {
		admission.settle("error");
		return fail();
	}
	if (!result.valid || !result.admin) {
		admission.settle("failure");
		return fail();
	}

	admission.settle("success");
	await holdUntilFloor(startedAt);
	const store = await cookies();
	store.set(
		SESSION_COOKIE,
		await createSession(name),
		SESSION_COOKIE_OPTIONS,
	);
	redirect("/");
}
