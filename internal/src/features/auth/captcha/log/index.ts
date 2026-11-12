import "server-only";

import type { CaptchaVerdict } from "../verify";

/** Seconds a repeated operator-facing line is held back, so a flood of attempts is one line. */
const REPEAT_QUIET_MS = 60_000;
const lastLogged = new Map<string, number>();

function once(key: string, now: number): boolean {
	const previous = lastLogged.get(key);
	if (previous !== undefined && now - previous < REPEAT_QUIET_MS) {
		return false;
	}
	lastLogged.set(key, now);
	return true;
}

/** Forget what was logged. Tests call it between cases. */
export function resetCaptchaLog(): void {
	lastLogged.clear();
}

/**
 * Tell the operator why sign-in is being refused for a CAPTCHA reason. The line
 * names the provider, the reason and the provider's plain error codes, or the
 * variable at fault; it never holds a token, a secret or a configured value. A
 * configuration problem repeats at most once a minute.
 */
export function logCaptchaRefusal(
	provider: string,
	verdict: Extract<CaptchaVerdict, { ok: false }>,
	now: number = Date.now(),
): void {
	if (verdict.reason === "misconfigured") {
		if (once(`${provider}:${verdict.detail}`, now)) {
			console.error(
				`captcha misconfigured, sign-in is refused until it is fixed: provider=${provider} ${verdict.detail}`,
			);
		}
		return;
	}
	const detail = verdict.detail === "" ? "" : ` detail=${verdict.detail}`;
	console.error(
		`captcha refused: provider=${provider} reason=${verdict.reason}${detail}`,
	);
}

/** The same operator-facing line for a configuration that never got as far as a verdict. */
export function logCaptchaConfigProblem(
	problem: string,
	now: number = Date.now(),
): void {
	if (once(`config:${problem}`, now)) {
		console.error(
			`captcha misconfigured, sign-in is refused until it is fixed: ${problem}`,
		);
	}
}
