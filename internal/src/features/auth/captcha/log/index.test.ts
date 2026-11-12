import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";

import { logCaptchaConfigProblem, logCaptchaRefusal, resetCaptchaLog } from ".";

let errors: ReturnType<typeof spyOn>;
beforeEach(() => {
	resetCaptchaLog();
	errors = spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => errors.mockRestore());

const lines = () => errors.mock.calls.map((call: unknown[]) => String(call[0]));

describe("logCaptchaRefusal", () => {
	it("names the provider, the reason and the plain codes", () => {
		logCaptchaRefusal("turnstile", {
			ok: false,
			reason: "rejected",
			detail: "invalid-input-response",
		});

		expect(lines()).toEqual([
			"captcha refused: provider=turnstile reason=rejected detail=invalid-input-response",
		]);
	});

	it("leaves out an empty detail", () => {
		logCaptchaRefusal("hcaptcha", {
			ok: false,
			reason: "unavailable",
			detail: "",
		});

		expect(lines()).toEqual([
			"captcha refused: provider=hcaptcha reason=unavailable",
		]);
	});

	it("tells the operator sign-in is refused for a misconfiguration, once a minute per problem", () => {
		const verdict = {
			ok: false,
			reason: "misconfigured",
			detail: "EPISTLE_PANEL_CAPTCHA_SECRET_KEY_FILE is set but the file cannot be read",
		} as const;

		logCaptchaRefusal("recaptcha", verdict, 1_000);
		logCaptchaRefusal("recaptcha", verdict, 30_000);
		logCaptchaRefusal("recaptcha", verdict, 61_001);

		expect(lines()).toHaveLength(2);
		expect(lines()[0]).toContain("sign-in is refused until it is fixed");
		expect(lines()[0]).toContain("EPISTLE_PANEL_CAPTCHA_SECRET_KEY_FILE");
	});
});

describe("logCaptchaConfigProblem", () => {
	it("repeats at most once a minute, and a different problem is its own line", () => {
		logCaptchaConfigProblem("EPISTLE_PANEL_CAPTCHA_SITE_KEY is missing", 0);
		logCaptchaConfigProblem(
			"EPISTLE_PANEL_CAPTCHA_SITE_KEY is missing",
			59_999,
		);
		logCaptchaConfigProblem(
			"EPISTLE_PANEL_CAPTCHA_PROVIDER is not one of x",
			59_999,
		);
		logCaptchaConfigProblem(
			"EPISTLE_PANEL_CAPTCHA_SITE_KEY is missing",
			60_000,
		);

		expect(lines()).toHaveLength(3);
	});
});
