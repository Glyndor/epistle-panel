import { describe, expect, it } from "bun:test";

import { CAPTCHA_CSP_ALLOWLIST } from "@/lib/security-headers/captcha-sources";

import { BUILT_IN_PROVIDERS } from ".";

describe("BUILT_IN_PROVIDERS", () => {
	it("serves every URL over https, from a host the CSP allowlist names", () => {
		for (const [provider, urls] of Object.entries(BUILT_IN_PROVIDERS)) {
			const script = new URL(urls.scriptUrl);
			const verify = new URL(urls.verifyUrl);
			expect(script.protocol).toBe("https:");
			expect(verify.protocol).toBe("https:");
			const allowed =
				CAPTCHA_CSP_ALLOWLIST[
					provider as keyof typeof CAPTCHA_CSP_ALLOWLIST
				];
			const covered = allowed.script.some((source) => {
				const host = new URL(source.replace("*.", "")).host;
				return script.host === host || script.host.endsWith(`.${host}`);
			});
			expect(covered).toBe(true);
		}
	});

	it("loads each widget in explicit-render mode", () => {
		for (const { scriptUrl } of Object.values(BUILT_IN_PROVIDERS)) {
			expect(scriptUrl).toContain("render=explicit");
		}
	});
});
