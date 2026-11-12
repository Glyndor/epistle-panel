import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";

import { CAPTCHA_VARIABLES } from "@/features/auth/captcha/config";
import {
	BUILT_IN_PROVIDERS,
	type PublicCaptcha,
} from "@/features/auth/captcha/providers";
import { resetScriptCache } from "@/features/auth/captcha/widget-adapters";
import { sentRequests } from "@/lib/api/test-support/fetch";
import { resetLoginLimiter } from "@/lib/auth/login-limiter";
import { mockRequestCookies } from "@/lib/auth/test-support/cookies";
import { clearSecretCache } from "@/lib/config/secret";
import { scriptsFinishWith } from "@/test/script-loading";

// The real action runs, with `fetch` stubbed for both the provider and the API.
const originalFetch = globalThis.fetch;
const win = window as unknown as Record<string, unknown>;
mockRequestCookies();
const { LoginForm } = await import(".");

const config: PublicCaptcha = {
	provider: "turnstile",
	siteKey: "site-key",
	scriptUrl: BUILT_IN_PROVIDERS.turnstile.scriptUrl,
	responseField: "captcha-response",
};
const TOKEN = "solved-token";

let widgetParameters: Record<string, unknown> = {};
const reset = mock(() => {});

beforeEach(() => {
	process.env["EPISTLE_PANEL_LOGIN_MIN_MS"] = "0";
	Object.assign(process.env, {
		[CAPTCHA_VARIABLES.provider]: "turnstile",
		[CAPTCHA_VARIABLES.siteKey]: "site-key",
		[CAPTCHA_VARIABLES.secretKey]: "secret",
	});
	clearSecretCache();
	resetLoginLimiter();
	resetScriptCache();
	reset.mockClear();
	win["turnstile"] = {
		render: (_el: HTMLElement, parameters: Record<string, unknown>) => {
			widgetParameters = parameters;
			return "w1";
		},
		reset,
		remove: () => {},
	};
	globalThis.fetch = mock(async (url: string | URL | Request) =>
		String(url).includes("siteverify")
			? new Response(JSON.stringify({ success: true, action: "login" }), {
					headers: { "content-type": "application/json" },
				})
			: new Response(JSON.stringify({ valid: false, admin: false }), {
					headers: { "content-type": "application/json" },
				}),
	) as unknown as typeof fetch;
});
afterEach(() => {
	cleanup();
	scriptsFinishWith("load");
	globalThis.fetch = originalFetch;
	for (const name of Object.values(CAPTCHA_VARIABLES)) {
		delete process.env[name];
	}
	delete process.env["EPISTLE_PANEL_LOGIN_MIN_MS"];
	delete win["turnstile"];
	for (const script of document.head.querySelectorAll("script")) {
		script.remove();
	}
	clearSecretCache();
});

const type = (label: string, value: string) =>
	act(async () => {
		fireEvent.change(screen.getByLabelText(label), { target: { value } });
	});
const submit = () =>
	act(async () => {
		fireEvent.click(screen.getByRole("button", { name: "submit" }));
	});
const solve = () =>
	act(async () => {
		(widgetParameters["callback"] as (t: string) => void)(TOKEN);
	});
const providerCalls = () =>
	sentRequests().filter((r) => r.url.includes("siteverify"));
const apiCalls = () =>
	sentRequests().filter((r) => r.url.endsWith("/auth/verify"));

async function ready() {
	render(<LoginForm captcha={config} />);
	await screen.findByRole("group", { name: "captchaLabel" });
	await waitFor(() => expect(widgetParameters["sitekey"]).toBe("site-key"));
}

describe("LoginForm with a CAPTCHA", () => {
	it("draws the widget in a named group, with the site key and the login action", async () => {
		await ready();

		expect(widgetParameters).toMatchObject({
			sitekey: "site-key",
			action: "login",
		});
	});

	it("draws no widget and loads no script when the CAPTCHA is off", async () => {
		render(<LoginForm captcha={null} />);

		expect(
			screen.queryByRole("group", { name: "captchaLabel" }),
		).toBeNull();
		expect(document.head.querySelectorAll("script")).toHaveLength(0);
	});

	it("asks for the challenge before any request when it is not solved", async () => {
		await ready();
		await type("name", "ops");
		await type("password", "pw");

		await submit();

		expect(await screen.findByText("captchaRequired")).toBeInTheDocument();
		expect(sentRequests()).toHaveLength(0);
	});

	it("sends the token with the credentials once solved, and the provider is asked before the API", async () => {
		await ready();
		await type("name", "ops");
		await type("password", "pw");
		await solve();

		await submit();

		await waitFor(() => expect(apiCalls()).toHaveLength(1));
		expect(providerCalls()).toHaveLength(1);
		expect(
			new URLSearchParams(providerCalls()[0]?.body).get("response"),
		).toBe(TOKEN);
		expect(sentRequests().map((r) => r.url.includes("siteverify"))).toEqual(
			[true, false],
		);
	});

	it("draws a new challenge after the answer, because a token is single use, and asks for it again", async () => {
		await ready();
		await type("name", "ops");
		await type("password", "pw");
		await solve();
		await submit();
		await waitFor(() =>
			expect(document.getElementById("login-error")).not.toBeNull(),
		);

		await waitFor(() => expect(reset).toHaveBeenCalled());
		await type("password", "pw");
		await submit();

		expect(await screen.findByText("captchaRequired")).toBeInTheDocument();
		expect(apiCalls()).toHaveLength(1);
	});

	it("clears the error as soon as the challenge is solved", async () => {
		await ready();
		await submit();
		await screen.findByText("captchaRequired");

		await solve();

		await waitFor(() =>
			expect(screen.queryByText("captchaRequired")).toBeNull(),
		);
	});

	it("says so when the widget cannot be loaded, and still sends nothing", async () => {
		scriptsFinishWith("error");
		render(<LoginForm captcha={config} />);

		expect(
			await screen.findByText("captchaLoadFailed"),
		).toBeInTheDocument();
		await type("name", "ops");
		await type("password", "pw");
		await submit();
		expect(apiCalls()).toHaveLength(0);
	});

	it("reads a custom widget's token from the input it writes at submit time", async () => {
		process.env[CAPTCHA_VARIABLES.provider] = "custom";
		process.env[CAPTCHA_VARIABLES.scriptUrl] =
			"https://widgets.example/w.js";
		process.env[CAPTCHA_VARIABLES.verifyUrl] =
			"https://widgets.example/siteverify";
		const custom: PublicCaptcha = {
			provider: "custom",
			siteKey: "site-key",
			scriptUrl: "https://widgets.example/w.js",
			responseField: "my-token",
		};
		const { container } = render(<LoginForm captcha={custom} />);
		await waitFor(() =>
			expect(container.querySelector(".captcha-widget")).toHaveAttribute(
				"data-sitekey",
				"site-key",
			),
		);
		await act(async () => {
			const input = document.createElement("input");
			input.name = "my-token";
			input.value = "custom-solved";
			container.querySelector("form")?.append(input);
		});
		await type("name", "ops");
		await type("password", "pw");

		await submit();

		await waitFor(() => expect(providerCalls()).toHaveLength(1));
		expect(
			new URLSearchParams(providerCalls()[0]?.body).get("response"),
		).toBe("custom-solved");
	});
});
