"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getCaptchaConfig } from "@/features/auth/captcha/config";
import {
	logCaptchaConfigProblem,
	logCaptchaRefusal,
} from "@/features/auth/captcha/log";
import { verifyCaptcha } from "@/features/auth/captcha/verify";
import { captchaLoginSchema, loginSchema } from "@/features/auth/schemas/login";
import type { LoginState } from "@/features/auth/schemas/login-state";
import { verifyCredentials } from "@/lib/api/client";
import { admitAttempt } from "@/lib/auth/login-limiter";
import { holdUntilFloor } from "@/lib/auth/response-floor";
import {
	createSession,
	SESSION_COOKIE,
	SESSION_COOKIE_OPTIONS,
} from "@/lib/auth/session";
import { ROUTES } from "@/lib/routes";

/**
 * Verify submitted credentials against the mail server and, if they belong to
 * a panel admin, establish the session cookie and redirect into the panel.
 * Every outcome, success included, takes the same minimum time (see
 * `response-floor`), and a failure returns the same outcome whatever its cause,
 * so the response does not reveal which accounts exist. When a CAPTCHA is on it
 * is verified first, then the limiter runs: a refused attempt never reaches the API. Only the `throttled` outcome tells a refusal
 * apart, and it applies to any name, existing or not.
 */
export async function login(
	_previous: LoginState,
	formData: FormData,
): Promise<LoginState> {
	const startedAt = Date.now();
	const fail = async (
		outcome: "failed" | "throttled" = "failed",
	): Promise<LoginState> => {
		await holdUntilFloor(startedAt);
		return { outcome };
	};

	// The schema the form validates with is the real gate here. Whatever it
	// refuses (empty, over the length caps, not a string) is the generic failure,
	// after the same minimum time, and never reaches the limiter or the API.
	const captcha = getCaptchaConfig();
	const input = {
		name: formData.get("name"),
		password: formData.get("password"),
		captcha: formData.get("captcha") ?? undefined,
	};
	const parsed =
		captcha.state === "enabled"
			? captchaLoginSchema.safeParse(input)
			: loginSchema.safeParse(input);
	if (!parsed.success) {
		return fail();
	}
	const { name, password } = parsed.data;

	// The CAPTCHA comes before the limiter: a bot that cannot solve it never
	// counts against a name's backoff or the global ceiling, so it cannot lock
	// out an operator or burn the shared allowance. A token is single use, so
	// the form draws a new challenge after every answer. Misconfigured fails
	// closed: sign-in stays refused, and the log says why.
	if (captcha.state === "misconfigured") {
		logCaptchaConfigProblem(captcha.problem);
		return fail();
	}
	if (captcha.state === "enabled") {
		const verdict = await verifyCaptcha(captcha, parsed.data.captcha ?? "");
		if (!verdict.ok) {
			logCaptchaRefusal(captcha.provider, verdict);
			return fail();
		}
	}
	const admission = admitAttempt(name);
	if (!admission.allowed) {
		return fail("throttled");
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
	redirect(ROUTES.home);
}
