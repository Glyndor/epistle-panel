import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";

import { CAPTCHA_VARIABLES } from "@/features/auth/captcha/config";
import {
	mockRequestCookies,
	RedirectSignal,
} from "@/lib/auth/test-support/cookies";

const cookies = mockRequestCookies();

const { default: LoginPage } = await import("./page");

beforeEach(() => cookies.reset());

afterEach(() => {
	cleanup();
	for (const name of Object.values(CAPTCHA_VARIABLES)) {
		delete process.env[name];
	}
});

describe("LoginPage", () => {
	it("sends a visitor who already has a session, of any role, to the mail area", async () => {
		for (const role of ["admin", "user"] as const) {
			await cookies.signIn("someone", role);

			const outcome = await LoginPage().catch((e) => e);

			expect(outcome).toBeInstanceOf(RedirectSignal);
			expect(outcome.target).toBe("/app/mail");
		}
	});

	it("shows the form for a forged cookie", async () => {
		cookies.jar.set("__Host-epistle_session", "forged.token");

		render(await LoginPage());

		expect(screen.getByLabelText("name")).toBeInTheDocument();
	});

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
