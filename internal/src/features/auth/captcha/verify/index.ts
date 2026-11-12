import "server-only";

import { z } from "zod";

import { EpistleApiResponseTooLargeError } from "@/lib/api/error";
import { readJsonBody } from "@/lib/api/read-body";
import { ConfigError } from "@/lib/config/config-error";
import { readSecret } from "@/lib/config/secret";
import { CAPTCHA_VARIABLES, type CaptchaConfig } from "../config";
import { CAPTCHA_ACTION, CAPTCHA_TOKEN_MAX } from "../providers";
import { createSlotGate } from "../slot-gate";

/** Time the provider has to answer, in milliseconds. */
export const VERIFY_TIMEOUT_MS = 5_000;

/** Largest verification answer read, in bytes. Real ones are a few hundred. */
export const VERIFY_MAX_BYTES = 16 * 1024;

/** Verifications that may be in flight at once. */
export const VERIFY_MAX_IN_FLIGHT = 16;

/**
 * A call above the ceiling waits for a slot, first in first out, for at most
 * this long and with at most this many others in line; past either it is
 * refused without a request. A short burst is absorbed; sustained concurrency
 * above the ceiling still refuses sign-ins.
 */
export const VERIFY_QUEUE_WAIT_MS = 1_500;
export const VERIFY_QUEUE_MAX = 32;

/** How the check ended. Every `ok: false` is the same generic failure for the person. */
export type CaptchaVerdict =
	| { readonly ok: true }
	| {
			readonly ok: false;
			/**
			 * `rejected`: the provider said the token is not valid. `mismatch`: it is
			 * valid but for another host or action. `unavailable`: no usable answer
			 * (network, timeout, status, size, shape, or too many in flight).
			 * `misconfigured`: the secret key could not be read.
			 */
			readonly reason:
				| "rejected"
				| "mismatch"
				| "unavailable"
				| "misconfigured";
			/** The provider's error codes, plain words only; or the config problem text. */
			readonly detail: string;
	  };

/**
 * The answer shape the three providers and the custom contract share. Unknown
 * fields are ignored, because providers add some; `success` is required.
 */
const answerSchema = z.object({
	success: z.boolean(),
	hostname: z.string().optional(),
	action: z.string().optional(),
	"error-codes": z.array(z.string()).optional(),
});

const SAFE_CODE = /^[a-z0-9-]{1,50}$/;

const slots = createSlotGate({
	max: VERIFY_MAX_IN_FLIGHT,
	queueMax: VERIFY_QUEUE_MAX,
	waitMs: VERIFY_QUEUE_WAIT_MS,
});

const failure = (
	reason: "rejected" | "mismatch" | "unavailable" | "misconfigured",
	detail = "",
): CaptchaVerdict => ({ ok: false, reason, detail });

/**
 * Ask the provider whether `token` is a solved challenge.
 *
 * The secret is read from its file (the shared validated reader), the token is
 * posted form-encoded, and the call has its own timeout, a 16 KiB cap on the
 * answer, no redirects and a ceiling on concurrent calls, so a slow or hostile
 * provider cannot hold the sign-in open or the process's memory. Anything but a
 * clear `success: true` is a refusal. When the operator set a host name the
 * provider's `hostname` must equal it, and a Turnstile answer must carry the
 * `login` action the widget was asked for. Neither the token nor the secret is
 * returned or logged.
 */
export async function verifyCaptcha(
	config: Extract<CaptchaConfig, { state: "enabled" }>,
	token: string,
): Promise<CaptchaVerdict> {
	if (token === "" || token.length > CAPTCHA_TOKEN_MAX) {
		return failure("rejected", "missing-or-oversized-token");
	}
	let secret: string | undefined;
	try {
		secret = await readSecret(CAPTCHA_VARIABLES.secretKey);
	} catch (error) {
		return failure(
			"misconfigured",
			error instanceof ConfigError
				? error.message
				: "secret key unreadable",
		);
	}
	if (secret === undefined) {
		return failure(
			"misconfigured",
			`${CAPTCHA_VARIABLES.secretKey} is not set`,
		);
	}
	if (!(await slots.acquire())) {
		return failure("unavailable", "too-many-in-flight");
	}
	try {
		const response = await fetch(config.verifyUrl, {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({ secret, response: token }),
			redirect: "error",
			cache: "no-store",
			signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS),
		});
		if (!response.ok) {
			await response.body?.cancel();
			return failure("unavailable", `status-${response.status}`);
		}
		const parsed = answerSchema.safeParse(
			await readJsonBody(response, VERIFY_MAX_BYTES),
		);
		if (!parsed.success) {
			return failure("unavailable", "malformed-answer");
		}
		const answer = parsed.data;
		if (!answer.success) {
			const codes = (answer["error-codes"] ?? [])
				// A provider (or an impostor) could echo the token or the secret in a
				// code; a plain-word shape is not enough to rule that out.
				.filter(
					(code) =>
						SAFE_CODE.test(code) &&
						!code.includes(token) &&
						!code.includes(secret),
				)
				.slice(0, 5)
				.join(",");
			return failure("rejected", codes);
		}
		if (
			config.hostname !== null &&
			answer.hostname?.toLowerCase() !== config.hostname
		) {
			return failure("mismatch", "hostname");
		}
		if (
			config.provider === "turnstile" &&
			answer.action !== CAPTCHA_ACTION
		) {
			return failure("mismatch", "action");
		}
		return { ok: true };
	} catch (error) {
		if (error instanceof EpistleApiResponseTooLargeError) {
			return failure("unavailable", "answer-too-large");
		}
		return failure(
			"unavailable",
			error instanceof Error ? error.name : "error",
		);
	} finally {
		slots.release();
	}
}
