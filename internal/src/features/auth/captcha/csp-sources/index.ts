import type { CspWidening } from "@/lib/security-headers";

/** The CAPTCHA providers the sign-in page can load a widget from. */
export const CAPTCHA_PROVIDERS = [
	"turnstile",
	"recaptcha",
	"hcaptcha",
	"custom",
] as const;
export type CaptchaProviderId = (typeof CAPTCHA_PROVIDERS)[number];

/**
 * What each built-in provider needs and nothing more, from the provider's own
 * documentation. Only the sign-in page is widened with it, and only for the
 * provider the operator enabled. There is no `style-src` or `img-src` entry:
 * the widgets draw inside their own frame, and the panel's `style-src 'self'`
 * stays as it is. Under `strict-dynamic` the browser ignores the script hosts,
 * which are kept for browsers that do not support it.
 */
export const CAPTCHA_CSP_ALLOWLIST: Record<
	Exclude<CaptchaProviderId, "custom">,
	CspWidening
> = {
	turnstile: {
		script: ["https://challenges.cloudflare.com"],
		frame: ["https://challenges.cloudflare.com"],
		connect: ["https://challenges.cloudflare.com"],
	},
	recaptcha: {
		script: [
			"https://www.google.com/recaptcha/",
			"https://www.gstatic.com/recaptcha/",
		],
		frame: [
			"https://www.google.com/recaptcha/",
			"https://recaptcha.google.com/recaptcha/",
		],
		connect: ["https://www.google.com/recaptcha/"],
	},
	hcaptcha: {
		script: ["https://hcaptcha.com", "https://*.hcaptcha.com"],
		frame: ["https://hcaptcha.com", "https://*.hcaptcha.com"],
		connect: ["https://hcaptcha.com", "https://*.hcaptcha.com"],
	},
};

/**
 * The widening for a provider. A `custom` provider has no fixed hosts: it gets
 * the one origin of the script the operator named (`customOrigin`, already
 * validated as an origin), for the script, its frame and its requests. Without
 * that origin it gets nothing.
 */
export function captchaCspWidening(
	provider: CaptchaProviderId,
	customOrigin?: string,
): CspWidening | undefined {
	if (provider === "custom") {
		return customOrigin === undefined
			? undefined
			: {
					script: [customOrigin],
					frame: [customOrigin],
					connect: [customOrigin],
				};
	}
	return CAPTCHA_CSP_ALLOWLIST[provider];
}
