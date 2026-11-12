import { describe, expect, it } from "bun:test";

import { CAPTCHA_CSP_ALLOWLIST } from "@/lib/security-headers/captcha-sources";

import { captchaWideningFromEnv, getCaptchaConfig, getPublicCaptcha } from ".";

const base = {
	EPISTLE_PANEL_CAPTCHA_PROVIDER: "turnstile",
	EPISTLE_PANEL_CAPTCHA_SITE_KEY: "site-key",
	EPISTLE_PANEL_CAPTCHA_SECRET_KEY_FILE: "/run/secrets/captcha",
};
const custom = {
	...base,
	EPISTLE_PANEL_CAPTCHA_PROVIDER: "custom",
	EPISTLE_PANEL_CAPTCHA_SCRIPT_URL: "https://captcha.example/widget.js",
	EPISTLE_PANEL_CAPTCHA_VERIFY_URL: "https://captcha.example/verify",
};

const problem = (env: Record<string, string | undefined>) => {
	const config = getCaptchaConfig(env);
	return config.state === "misconfigured"
		? config.problem
		: `not misconfigured: ${config.state}`;
};

describe("getCaptchaConfig", () => {
	it("is off when no provider is set, or when it says off", () => {
		expect(getCaptchaConfig({})).toEqual({ state: "off" });
		expect(
			getCaptchaConfig({ EPISTLE_PANEL_CAPTCHA_PROVIDER: "" }),
		).toEqual({ state: "off" });
		expect(
			getCaptchaConfig({ EPISTLE_PANEL_CAPTCHA_PROVIDER: " off " }),
		).toEqual({ state: "off" });
	});

	it("is off however the other settings are filled in, until the provider is set", () => {
		expect(
			getCaptchaConfig({ EPISTLE_PANEL_CAPTCHA_SITE_KEY: "k" }),
		).toEqual({ state: "off" });
	});

	it("enables each built-in provider with its own script and verification URL", () => {
		for (const provider of ["turnstile", "recaptcha", "hcaptcha"]) {
			const config = getCaptchaConfig({
				...base,
				EPISTLE_PANEL_CAPTCHA_PROVIDER: provider,
			});

			expect(config).toMatchObject({
				state: "enabled",
				provider,
				siteKey: "site-key",
				hostname: null,
			});
			if (config.state === "enabled") {
				expect(config.scriptUrl).toStartWith("https://");
				expect(config.verifyUrl).toStartWith("https://");
			}
		}
	});

	it("accepts the secret as a plain variable or as a file", () => {
		const { EPISTLE_PANEL_CAPTCHA_SECRET_KEY_FILE: _file, ...rest } = base;

		expect(
			getCaptchaConfig({ ...rest, EPISTLE_PANEL_CAPTCHA_SECRET_KEY: "s" })
				.state,
		).toBe("enabled");
		expect(getCaptchaConfig(base).state).toBe("enabled");
	});

	it("fails closed, naming the variable, for an unknown provider, a missing site key or a missing secret", () => {
		expect(
			problem({ ...base, EPISTLE_PANEL_CAPTCHA_PROVIDER: "friendly" }),
		).toContain("EPISTLE_PANEL_CAPTCHA_PROVIDER");
		expect(
			problem({ ...base, EPISTLE_PANEL_CAPTCHA_SITE_KEY: "" }),
		).toContain("SITE_KEY");
		expect(
			problem({
				...base,
				EPISTLE_PANEL_CAPTCHA_SITE_KEY: "k".repeat(257),
			}),
		).toContain("SITE_KEY");
		expect(
			problem({
				...base,
				EPISTLE_PANEL_CAPTCHA_SECRET_KEY_FILE: undefined,
			}),
		).toContain("SECRET_KEY");
	});

	it("never puts a configured value in the problem text", () => {
		const text = problem({
			...custom,
			EPISTLE_PANEL_CAPTCHA_SITE_KEY: "super-site-key",
			EPISTLE_PANEL_CAPTCHA_VERIFY_URL:
				"http://user:pass@evil.example/secret-path",
		});

		expect(text).toContain("VERIFY_URL");
		for (const leaked of [
			"super-site-key",
			"evil.example",
			"secret-path",
			"pass",
			"/run/secrets",
		]) {
			expect(text).not.toContain(leaked);
		}
	});

	it("enables custom with its URLs and the default response field", () => {
		const config = getCaptchaConfig(custom);

		expect(config).toMatchObject({
			state: "enabled",
			provider: "custom",
			scriptUrl: "https://captcha.example/widget.js",
			verifyUrl: "https://captcha.example/verify",
			responseField: "captcha-response",
		});
	});

	it("takes a custom response field and an expected hostname, and refuses malformed ones", () => {
		expect(
			getCaptchaConfig({
				...custom,
				EPISTLE_PANEL_CAPTCHA_RESPONSE_FIELD: "my-token",
				EPISTLE_PANEL_CAPTCHA_HOSTNAME: "Panel.Example.org",
			}),
		).toMatchObject({
			responseField: "my-token",
			hostname: "panel.example.org",
		});
		expect(
			problem({ ...custom, EPISTLE_PANEL_CAPTCHA_RESPONSE_FIELD: "a b" }),
		).toContain("RESPONSE_FIELD");
		expect(
			problem({
				...custom,
				EPISTLE_PANEL_CAPTCHA_RESPONSE_FIELD: "x".repeat(65),
			}),
		).toContain("RESPONSE_FIELD");
		expect(
			problem({ ...base, EPISTLE_PANEL_CAPTCHA_HOSTNAME: "bad host/" }),
		).toContain("HOSTNAME");
	});

	it("refuses a custom URL that is missing, not a URL, not https, or carries credentials", () => {
		for (const value of [
			undefined,
			"not a url",
			"http://captcha.example/w.js",
			"ftp://captcha.example/w.js",
			"https://user:pw@captcha.example/w.js",
			"javascript:alert(1)",
		]) {
			expect(
				problem({ ...custom, EPISTLE_PANEL_CAPTCHA_SCRIPT_URL: value }),
			).toContain("SCRIPT_URL");
			expect(
				problem({ ...custom, EPISTLE_PANEL_CAPTCHA_VERIFY_URL: value }),
			).toContain("VERIFY_URL");
		}
	});

	it("allows plain http for a loopback host only, as the end-to-end stand-in needs", () => {
		for (const host of ["127.0.0.1:9", "localhost:9", "[::1]:9"]) {
			expect(
				getCaptchaConfig({
					...custom,
					EPISTLE_PANEL_CAPTCHA_SCRIPT_URL: `http://${host}/w.js`,
					EPISTLE_PANEL_CAPTCHA_VERIFY_URL: `http://${host}/v`,
				}).state,
			).toBe("enabled");
		}
		expect(
			problem({
				...custom,
				EPISTLE_PANEL_CAPTCHA_SCRIPT_URL: "http://10.0.0.5/w.js",
			}),
		).toContain("SCRIPT_URL");
	});
});

describe("getPublicCaptcha", () => {
	it("is null when off or misconfigured, so the page draws no widget", () => {
		expect(getPublicCaptcha({})).toBeNull();
		expect(
			getPublicCaptcha({ ...base, EPISTLE_PANEL_CAPTCHA_SITE_KEY: "" }),
		).toBeNull();
	});

	it("holds the public site key and the script, and nothing secret", () => {
		const publicConfig = getPublicCaptcha({
			...custom,
			EPISTLE_PANEL_CAPTCHA_SECRET_KEY: "hunter2",
		});

		expect(publicConfig).toEqual({
			provider: "custom",
			siteKey: "site-key",
			scriptUrl: "https://captcha.example/widget.js",
			responseField: "captcha-response",
		});
		expect(JSON.stringify(publicConfig)).not.toContain("hunter2");
		expect(JSON.stringify(publicConfig)).not.toContain("verify");
	});
});

describe("captchaWideningFromEnv", () => {
	it("widens nothing when off or misconfigured", () => {
		expect(captchaWideningFromEnv({})).toBeUndefined();
		expect(
			captchaWideningFromEnv({
				...base,
				EPISTLE_PANEL_CAPTCHA_SITE_KEY: "",
			}),
		).toBeUndefined();
	});

	it("gives each built-in provider its allowlist entry exactly", () => {
		for (const provider of [
			"turnstile",
			"recaptcha",
			"hcaptcha",
		] as const) {
			expect(
				captchaWideningFromEnv({
					...base,
					EPISTLE_PANEL_CAPTCHA_PROVIDER: provider,
				}),
			).toBe(CAPTCHA_CSP_ALLOWLIST[provider]);
		}
	});

	it("gives custom the origin of its script, not its path and not its verification host", () => {
		const widening = captchaWideningFromEnv({
			...custom,
			EPISTLE_PANEL_CAPTCHA_SCRIPT_URL:
				"https://cdn.captcha.example/deep/widget.js?v=1",
			EPISTLE_PANEL_CAPTCHA_VERIFY_URL:
				"https://verify.other.example/check",
		});

		expect(widening).toEqual({
			script: ["https://cdn.captcha.example"],
			frame: ["https://cdn.captcha.example"],
			connect: ["https://cdn.captcha.example"],
		});
	});
});
