import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";

import { CAPTCHA_VARIABLES } from "@/features/auth/captcha/config";

const { default: LoginPage } = await import("./page");

afterEach(() => {
	cleanup();
	for (const name of Object.values(CAPTCHA_VARIABLES)) {
		delete process.env[name];
	}
});

describe("LoginPage", () => {
	it("shows the heading and the form, and no CAPTCHA by default", async () => {
		render(await LoginPage());

		expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
		expect(screen.getByLabelText("name")).toBeInTheDocument();
		expect(
			screen.queryByRole("group", { name: "captchaLabel" }),
		).toBeNull();
	});

	it("draws the widget's group when a provider is fully set up", async () => {
		Object.assign(process.env, {
			[CAPTCHA_VARIABLES.provider]: "hcaptcha",
			[CAPTCHA_VARIABLES.siteKey]: "site",
			[CAPTCHA_VARIABLES.secretKey]: "secret",
		});

		render(await LoginPage());

		expect(
			screen.getByRole("group", { name: "captchaLabel" }),
		).toBeInTheDocument();
	});

	it("draws no widget for a misconfigured provider: the action refuses sign-in instead", async () => {
		Object.assign(process.env, {
			[CAPTCHA_VARIABLES.provider]: "hcaptcha",
		});

		render(await LoginPage());

		expect(
			screen.queryByRole("group", { name: "captchaLabel" }),
		).toBeNull();
	});

	it("never puts the secret key in the page", async () => {
		Object.assign(process.env, {
			[CAPTCHA_VARIABLES.provider]: "turnstile",
			[CAPTCHA_VARIABLES.siteKey]: "site",
			[CAPTCHA_VARIABLES.secretKey]: "the-secret-value",
		});

		const { container } = render(await LoginPage());

		expect(container.innerHTML).not.toContain("the-secret-value");
	});
});
