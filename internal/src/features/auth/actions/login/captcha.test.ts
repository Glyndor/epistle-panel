import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	mock,
	spyOn,
} from "bun:test";

import { CAPTCHA_VARIABLES } from "@/features/auth/captcha/config";
import { resetCaptchaLog } from "@/features/auth/captcha/log";
import type { LoginState } from "@/features/auth/schemas/login-state";
import { sentRequests } from "@/lib/api/test-support/fetch";
import { FREE_ATTEMPTS, resetLoginLimiter } from "@/lib/auth/login-limiter";
import {
	mockRequestCookies,
	RedirectSignal,
} from "@/lib/auth/test-support/cookies";
import { clearSecretCache } from "@/lib/config/secret";
import { timeIt, useFakeClock, useRealClock } from "@/test/fake-clock";

const SECRET = "captcha-secret-value";
const TOKEN = "captcha-token-value";
const originalFetch = globalThis.fetch;
const cookies = mockRequestCookies();
const { login } = await import(".");

const INITIAL: LoginState = { outcome: "idle" };
const CAPTCHA_URL = "https://captcha.example/verify";

/** Answer the CAPTCHA endpoint and the API's sign-in separately, recording the order. */
function stubRoutes(
	captchaAnswer: () => Response | Error,
	apiAnswer = { valid: true, admin: true },
) {
	globalThis.fetch = mock(async (url: string | URL | Request) => {
		if (String(url) === CAPTCHA_URL) {
			const answer = captchaAnswer();
			if (answer instanceof Error) {
				throw answer;
			}
			return answer;
		}
		return new Response(JSON.stringify(apiAnswer), {
			headers: { "content-type": "application/json" },
		});
	}) as unknown as typeof fetch;
}
const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" },
	});
const calls = () => sentRequests();
const captchaCalls = () => calls().filter((call) => call.url === CAPTCHA_URL);
const apiCalls = () =>
	calls().filter((call) => call.url.endsWith("/auth/verify"));

function form(captcha?: string, name = "ops"): FormData {
	const data = new FormData();
	data.set("name", name);
	data.set("password", "pw");
	if (captcha !== undefined) {
		data.set("captcha", captcha);
	}
	return data;
}

function enable(extra: Record<string, string> = {}) {
	Object.assign(process.env, {
		EPISTLE_PANEL_CAPTCHA_PROVIDER: "custom",
		EPISTLE_PANEL_CAPTCHA_SITE_KEY: "site",
		[CAPTCHA_VARIABLES.secretKey]: SECRET,
		EPISTLE_PANEL_CAPTCHA_SCRIPT_URL: "https://captcha.example/widget.js",
		EPISTLE_PANEL_CAPTCHA_VERIFY_URL: CAPTCHA_URL,
		...extra,
	});
}

let errors: ReturnType<typeof spyOn>;
beforeEach(() => {
	cookies.reset();
	resetLoginLimiter();
	resetCaptchaLog();
	clearSecretCache();
	process.env["EPISTLE_PANEL_LOGIN_MIN_MS"] = "0";
	errors = spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
	globalThis.fetch = originalFetch;
	errors.mockRestore();
	for (const name of Object.values(CAPTCHA_VARIABLES)) {
		delete process.env[name];
	}
	delete process.env[`${CAPTCHA_VARIABLES.secretKey}_FILE`];
	delete process.env["EPISTLE_PANEL_LOGIN_MIN_MS"];
	clearSecretCache();
	useRealClock();
});

describe("login with the CAPTCHA off (the default)", () => {
	it("ignores a token and never calls a provider", async () => {
		stubRoutes(() => json({ success: true }));

		const outcome = await login(INITIAL, form(TOKEN)).catch((e) => e);

		expect(outcome).toBeInstanceOf(RedirectSignal);
		expect(captchaCalls()).toHaveLength(0);
		expect(apiCalls()).toHaveLength(1);
	});
});

describe("login with the CAPTCHA on", () => {
	it("refuses a missing token with the generic failure, before the provider and the API", async () => {
		enable();
		stubRoutes(() => json({ success: true }));

		for (const data of [form(), form("")]) {
			expect(await login(INITIAL, data)).toEqual({ outcome: "failed" });
		}

		expect(captchaCalls()).toHaveLength(0);
		expect(apiCalls()).toHaveLength(0);
	});

	it("signs in with a token the provider confirms, asking the provider first", async () => {
		enable();
		stubRoutes(() => json({ success: true }));

		const outcome = await login(INITIAL, form(TOKEN)).catch((e) => e);

		expect(outcome).toBeInstanceOf(RedirectSignal);
		expect(calls().map((call) => call.url === CAPTCHA_URL)).toEqual([
			true,
			false,
		]);
		expect(cookies.writes).toHaveLength(1);
	});

	it("refuses a token the provider rejects, and never reaches the API", async () => {
		enable();
		stubRoutes(() =>
			json({ success: false, "error-codes": ["invalid-input-response"] }),
		);

		expect(await login(INITIAL, form(TOKEN))).toEqual({
			outcome: "failed",
		});

		expect(apiCalls()).toHaveLength(0);
		expect(cookies.writes).toHaveLength(0);
		expect(String(errors.mock.calls[0]?.[0])).toBe(
			"captcha refused: provider=custom reason=rejected detail=invalid-input-response",
		);
	});

	it("refuses when the provider is down or answers nonsense, so an outage never opens sign-in", async () => {
		enable();
		for (const answer of [
			new Error("down"),
			json({ nope: 1 }),
			json({ success: true }, 500),
		]) {
			stubRoutes(() => answer);
			expect(await login(INITIAL, form(TOKEN))).toEqual({
				outcome: "failed",
			});
		}
		expect(apiCalls()).toHaveLength(0);
	});

	it("does not let a flood of token-less or rejected attempts burn the limiter", async () => {
		enable();
		stubRoutes(() => json({ success: false }));
		for (let i = 0; i < FREE_ATTEMPTS + 6; i++) {
			expect(
				await login(INITIAL, form(i % 2 ? TOKEN : undefined)),
			).toEqual({ outcome: "failed" });
		}

		stubRoutes(() => json({ success: true }));
		const outcome = await login(INITIAL, form(TOKEN)).catch((e) => e);

		// Had those refusals counted as failures the name would be locked by now.
		expect(outcome).toBeInstanceOf(RedirectSignal);
	});

	it("still applies the limiter to a name whose credentials keep failing", async () => {
		enable();
		stubRoutes(() => json({ success: true }), {
			valid: false,
			admin: false,
		});
		for (let i = 0; i < FREE_ATTEMPTS + 1; i++) {
			await login(INITIAL, form(TOKEN));
		}

		expect(await login(INITIAL, form(TOKEN))).toEqual({
			outcome: "throttled",
		});
	});

	it("holds a CAPTCHA refusal to the same minimum time as any other failure", async () => {
		enable();
		stubRoutes(() => json({ success: false }));
		process.env["EPISTLE_PANEL_LOGIN_MIN_MS"] = "300";
		useFakeClock();

		const refused = await timeIt(() => login(INITIAL, form(TOKEN)));

		expect(refused.value).toEqual({ outcome: "failed" });
		expect(refused.elapsedMs).toBe(300);
	});

	it("keeps the token and the secret out of the log and out of the answer", async () => {
		enable();
		stubRoutes(() =>
			json({ success: false, "error-codes": [TOKEN, SECRET] }),
		);

		const answer = await login(INITIAL, form(TOKEN));

		const logged = errors.mock.calls
			.map((call: unknown[]) => String(call[0]))
			.join("\n");
		for (const text of [logged, JSON.stringify(answer)]) {
			expect(text).not.toContain(TOKEN);
			expect(text).not.toContain(SECRET);
		}
	});
});

describe("login with the CAPTCHA misconfigured", () => {
	it("refuses every sign-in, even with a token, and tells the operator which variable is wrong", async () => {
		enable({ EPISTLE_PANEL_CAPTCHA_SITE_KEY: "" });
		stubRoutes(() => json({ success: true }));

		expect(await login(INITIAL, form(TOKEN))).toEqual({
			outcome: "failed",
		});

		expect(calls()).toHaveLength(0);
		expect(String(errors.mock.calls[0]?.[0])).toContain(
			"sign-in is refused until it is fixed",
		);
		expect(String(errors.mock.calls[0]?.[0])).toContain(
			"EPISTLE_PANEL_CAPTCHA_SITE_KEY",
		);
	});

	it("refuses when the secret file cannot be read, without naming its path", async () => {
		enable();
		delete process.env[CAPTCHA_VARIABLES.secretKey];
		process.env[`${CAPTCHA_VARIABLES.secretKey}_FILE`] =
			"/nonexistent/secret";
		stubRoutes(() => json({ success: true }));

		expect(await login(INITIAL, form(TOKEN))).toEqual({
			outcome: "failed",
		});

		expect(apiCalls()).toHaveLength(0);
		const logged = String(errors.mock.calls[0]?.[0]);
		expect(logged).toContain("EPISTLE_PANEL_CAPTCHA_SECRET_KEY_FILE");
		expect(logged).not.toContain("/nonexistent");
	});

	it("refuses an unknown provider name", async () => {
		enable({ EPISTLE_PANEL_CAPTCHA_PROVIDER: "friendlycaptcha" });
		stubRoutes(() => json({ success: true }));

		expect(await login(INITIAL, form(TOKEN))).toEqual({
			outcome: "failed",
		});
		expect(calls()).toHaveLength(0);
	});
});
