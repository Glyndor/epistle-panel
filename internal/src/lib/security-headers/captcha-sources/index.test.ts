import { describe, expect, it } from "bun:test";

import { buildCsp } from "..";
import {
	CAPTCHA_CSP_ALLOWLIST,
	CAPTCHA_PROVIDERS,
	captchaCspWidening,
} from ".";

const directive = (csp: string, name: string) =>
	csp.split("; ").find((d) => d.startsWith(`${name} `));
const base = buildCsp("n");

describe("captchaCspWidening", () => {
	it("has an entry for every built-in provider and none for custom", () => {
		for (const provider of CAPTCHA_PROVIDERS) {
			if (provider === "custom") {
				expect(captchaCspWidening(provider)).toBeUndefined();
			} else {
				expect(captchaCspWidening(provider)).toBe(
					CAPTCHA_CSP_ALLOWLIST[provider],
				);
			}
		}
	});

	it("gives custom the single origin of its script, for script, frame and connect", () => {
		expect(captchaCspWidening("custom", "https://captcha.example")).toEqual(
			{
				script: ["https://captcha.example"],
				frame: ["https://captcha.example"],
				connect: ["https://captcha.example"],
			},
		);
	});

	it("allows only https sources, no wildcard host beyond hCaptcha's own, and no script-src keyword", () => {
		for (const [provider, widening] of Object.entries(
			CAPTCHA_CSP_ALLOWLIST,
		)) {
			for (const source of [
				...widening.script,
				...widening.frame,
				...widening.connect,
			]) {
				expect(source).toStartWith("https://");
				expect(source).not.toContain("'");
				expect(source).not.toBe("https:");
				if (source.includes("*")) {
					expect(provider).toBe("hcaptcha");
					expect(source).toBe("https://*.hcaptcha.com");
				}
			}
		}
	});
});

describe("buildCsp with a CAPTCHA widening", () => {
	for (const provider of ["turnstile", "recaptcha", "hcaptcha"] as const) {
		it(`adds ${provider}'s sources to script, frame and connect and changes nothing else`, () => {
			const widening = CAPTCHA_CSP_ALLOWLIST[provider];
			const csp = buildCsp("n", false, widening);

			for (const source of widening.script) {
				expect(directive(csp, "script-src")).toContain(source);
			}
			for (const source of widening.connect) {
				expect(directive(csp, "connect-src")).toContain(source);
			}
			expect(directive(csp, "frame-src")).toBe(
				`frame-src 'self' ${widening.frame.join(" ")}`,
			);
			// Every other directive is the one the page has without a provider.
			for (const name of [
				"default-src",
				"style-src",
				"img-src",
				"font-src",
				"object-src",
				"base-uri",
				"form-action",
				"frame-ancestors",
			]) {
				expect(directive(csp, name)).toBe(directive(base, name));
			}
			expect(csp).not.toContain("unsafe-inline");
			expect(csp).not.toContain("unsafe-eval");
			expect(directive(csp, "style-src")).toBe("style-src 'self'");
		});
	}

	it("is the plain policy without a widening, with no frame-src of its own", () => {
		expect(directive(base, "frame-src")).toBeUndefined();
		expect(directive(base, "connect-src")).toBe("connect-src 'self'");
	});

	it("widens a custom provider by its one origin only", () => {
		const csp = buildCsp(
			"n",
			false,
			captchaCspWidening("custom", "http://127.0.0.1:9"),
		);

		expect(directive(csp, "script-src")).toContain("http://127.0.0.1:9");
		expect(directive(csp, "frame-src")).toBe(
			"frame-src 'self' http://127.0.0.1:9",
		);
		expect(directive(csp, "connect-src")).toBe(
			"connect-src 'self' http://127.0.0.1:9",
		);
	});
});
