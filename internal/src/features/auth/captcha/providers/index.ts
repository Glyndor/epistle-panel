import type { CaptchaProviderId } from "@/features/auth/captcha/csp-sources";

/** Where a built-in provider's widget script and verification endpoint live. */
export interface BuiltInProvider {
	/** Widget script, in explicit-render mode, loaded on the sign-in page only. */
	readonly scriptUrl: string;
	/** Endpoint the Server Action posts the token to; never reached by the browser. */
	readonly verifyUrl: string;
}

/**
 * The three providers the panel knows. The URLs are the providers' documented
 * ones; the CSP sources that go with them are in `lib/security-headers`.
 */
export const BUILT_IN_PROVIDERS: Record<
	Exclude<CaptchaProviderId, "custom">,
	BuiltInProvider
> = {
	turnstile: {
		scriptUrl:
			"https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit",
		verifyUrl: "https://challenges.cloudflare.com/turnstile/v0/siteverify",
	},
	recaptcha: {
		scriptUrl: "https://www.google.com/recaptcha/api.js?render=explicit",
		verifyUrl: "https://www.google.com/recaptcha/api/siteverify",
	},
	hcaptcha: {
		scriptUrl: "https://js.hcaptcha.com/1/api.js?render=explicit",
		verifyUrl: "https://api.hcaptcha.com/siteverify",
	},
};

/**
 * What the sign-in page hands the browser: which widget to draw and with which
 * public site key. It never holds the secret key or a verification URL.
 */
export interface PublicCaptcha {
	readonly provider: CaptchaProviderId;
	readonly siteKey: string;
	readonly scriptUrl: string;
	/** Name of the input a `custom` widget writes its token into. */
	readonly responseField: string;
}

/** The action a widget is asked for, checked again when the provider returns one. */
export const CAPTCHA_ACTION = "login";

/** Largest token accepted, in characters; real ones are a few KB at most. */
export const CAPTCHA_TOKEN_MAX = 8192;
