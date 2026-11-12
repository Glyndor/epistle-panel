import "server-only";

import {
	CAPTCHA_PROVIDERS,
	type CaptchaProviderId,
	type CspWidening,
	captchaCspWidening,
} from "@/lib/security-headers/captcha-sources";
import { BUILT_IN_PROVIDERS, type PublicCaptcha } from "../providers";

/** Environment variables of the sign-in CAPTCHA. Off unless the provider is set. */
export const CAPTCHA_VARIABLES = {
	provider: "EPISTLE_PANEL_CAPTCHA_PROVIDER",
	siteKey: "EPISTLE_PANEL_CAPTCHA_SITE_KEY",
	secretKey: "EPISTLE_PANEL_CAPTCHA_SECRET_KEY",
	scriptUrl: "EPISTLE_PANEL_CAPTCHA_SCRIPT_URL",
	verifyUrl: "EPISTLE_PANEL_CAPTCHA_VERIFY_URL",
	responseField: "EPISTLE_PANEL_CAPTCHA_RESPONSE_FIELD",
	hostname: "EPISTLE_PANEL_CAPTCHA_HOSTNAME",
} as const;

/** Input name a `custom` widget writes its token into when the operator names none. */
export const DEFAULT_RESPONSE_FIELD = "captcha-response";

/** The CAPTCHA settings in force, decided from the environment alone. */
export type CaptchaConfig =
	| { readonly state: "off" }
	/** A provider is set but the settings are unusable: sign-in is refused, never opened. */
	| { readonly state: "misconfigured"; readonly problem: string }
	| {
			readonly state: "enabled";
			readonly provider: CaptchaProviderId;
			readonly siteKey: string;
			readonly scriptUrl: string;
			readonly verifyUrl: string;
			readonly responseField: string;
			/** Hostname the provider must report the solve on, when the operator set one. */
			readonly hostname: string | null;
	  };

type Env = Readonly<Record<string, string | undefined>>;

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

function read(env: Env, name: string): string | undefined {
	const value = env[name]?.trim();
	return value === undefined || value === "" ? undefined : value;
}

/**
 * A URL the operator gave for the custom provider: https, or http for a loopback
 * host only (the end-to-end stand-in), with no credentials. Returns `undefined`
 * for anything else so the caller can name the variable.
 */
function operatorUrl(value: string | undefined): URL | undefined {
	if (value === undefined) {
		return undefined;
	}
	let url: URL;
	try {
		url = new URL(value);
	} catch {
		return undefined;
	}
	const plain = url.protocol === "http:" && LOOPBACK_HOSTS.has(url.hostname);
	if ((url.protocol !== "https:" && !plain) || url.username || url.password) {
		return undefined;
	}
	return url;
}

const bad = (problem: string): CaptchaConfig => ({
	state: "misconfigured",
	problem,
});

/**
 * Read the CAPTCHA settings. Unset (or `off`) means off. Anything that names a
 * provider but is not a complete, valid setup is `misconfigured`, and the
 * Server Action then refuses every sign-in rather than skipping the check. The
 * problem text names the variable and never a value. The secret key is not read
 * here (it comes from a file at verification time); only its presence is
 * checked.
 */
export function getCaptchaConfig(env: Env = process.env): CaptchaConfig {
	const V = CAPTCHA_VARIABLES;
	const raw = read(env, V.provider);
	if (raw === undefined || raw === "off") {
		return { state: "off" };
	}
	const provider = CAPTCHA_PROVIDERS.find((id) => id === raw);
	if (provider === undefined) {
		return bad(
			`${V.provider} is not one of ${CAPTCHA_PROVIDERS.join(", ")}`,
		);
	}
	const siteKey = read(env, V.siteKey);
	if (siteKey === undefined || siteKey.length > 256) {
		return bad(`${V.siteKey} is missing or longer than 256 characters`);
	}
	if (
		read(env, V.secretKey) === undefined &&
		read(env, `${V.secretKey}_FILE`) === undefined
	) {
		return bad(`${V.secretKey} or ${V.secretKey}_FILE is not set`);
	}
	const hostname = read(env, V.hostname)?.toLowerCase() ?? null;
	if (hostname !== null && !/^[a-z0-9.-]{1,253}$/.test(hostname)) {
		return bad(`${V.hostname} is not a host name`);
	}

	if (provider !== "custom") {
		const urls = BUILT_IN_PROVIDERS[provider];
		return {
			state: "enabled",
			provider,
			siteKey,
			scriptUrl: urls.scriptUrl,
			verifyUrl: urls.verifyUrl,
			responseField: DEFAULT_RESPONSE_FIELD,
			hostname,
		};
	}
	const script = operatorUrl(read(env, V.scriptUrl));
	if (script === undefined) {
		return bad(
			`${V.scriptUrl} must be an https URL (http only for a loopback host)`,
		);
	}
	const verify = operatorUrl(read(env, V.verifyUrl));
	if (verify === undefined) {
		return bad(
			`${V.verifyUrl} must be an https URL (http only for a loopback host)`,
		);
	}
	const responseField = read(env, V.responseField) ?? DEFAULT_RESPONSE_FIELD;
	if (!/^[A-Za-z0-9_.-]{1,64}$/.test(responseField)) {
		return bad(
			`${V.responseField} must be 1 to 64 letters, digits, dots, dashes or underscores`,
		);
	}
	return {
		state: "enabled",
		provider,
		siteKey,
		scriptUrl: script.href,
		verifyUrl: verify.href,
		responseField,
		hostname,
	};
}

/** What the sign-in page may show the browser, or `null` when there is no widget to draw. */
export function getPublicCaptcha(env: Env = process.env): PublicCaptcha | null {
	const config = getCaptchaConfig(env);
	if (config.state !== "enabled") {
		return null;
	}
	return {
		provider: config.provider,
		siteKey: config.siteKey,
		scriptUrl: config.scriptUrl,
		responseField: config.responseField,
	};
}

/**
 * The CSP sources the sign-in page needs for the enabled provider, from the
 * environment alone (no secret read, so the proxy can call it on every request).
 * A custom provider gets the origin of its own script. Off or misconfigured
 * widens nothing.
 */
export function captchaWideningFromEnv(
	env: Env = process.env,
): CspWidening | undefined {
	const config = getCaptchaConfig(env);
	if (config.state !== "enabled") {
		return undefined;
	}
	return captchaCspWidening(
		config.provider,
		config.provider === "custom"
			? new URL(config.scriptUrl).origin
			: undefined,
	);
}
