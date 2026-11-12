import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

import {
	sentRequests,
	stubFetchJson,
	stubFetchResponse,
	zeroStream,
} from "@/lib/api/test-support/fetch";
import { clearSecretCache } from "@/lib/config/secret";

import {
	CAPTCHA_VARIABLES,
	type CaptchaConfig,
	getCaptchaConfig,
} from "../config";
import { CAPTCHA_TOKEN_MAX } from "../providers";
import {
	VERIFY_MAX_BYTES,
	VERIFY_MAX_IN_FLIGHT,
	VERIFY_QUEUE_MAX,
	VERIFY_QUEUE_WAIT_MS,
	verifyCaptcha,
} from ".";

const SECRET = "the-secret-key-value";
const TOKEN = "the-token-value";
const originalFetch = globalThis.fetch;
type Enabled = Extract<CaptchaConfig, { state: "enabled" }>;

function enabled(
	provider: string,
	extra: Record<string, string> = {},
): Enabled {
	const config = getCaptchaConfig({
		EPISTLE_PANEL_CAPTCHA_PROVIDER: provider,
		EPISTLE_PANEL_CAPTCHA_SITE_KEY: "site",
		EPISTLE_PANEL_CAPTCHA_SECRET_KEY: SECRET,
		EPISTLE_PANEL_CAPTCHA_SCRIPT_URL: "https://captcha.example/widget.js",
		EPISTLE_PANEL_CAPTCHA_VERIFY_URL: "https://captcha.example/verify",
		...extra,
	});
	if (config.state !== "enabled") {
		throw new Error(`test config is ${config.state}`);
	}
	return config;
}

const PROVIDERS = ["turnstile", "recaptcha", "hcaptcha", "custom"] as const;
const ok = (provider: string) =>
	provider === "turnstile"
		? { success: true, action: "login" }
		: { success: true };

beforeEach(() => {
	process.env[CAPTCHA_VARIABLES.secretKey] = SECRET;
	clearSecretCache();
});
afterEach(() => {
	globalThis.fetch = originalFetch;
	delete process.env[CAPTCHA_VARIABLES.secretKey];
	delete process.env[`${CAPTCHA_VARIABLES.secretKey}_FILE`];
	clearSecretCache();
});

for (const provider of PROVIDERS) {
	describe(`verifyCaptcha (${provider})`, () => {
		it("accepts a token the provider confirms", async () => {
			stubFetchJson(ok(provider));

			expect(await verifyCaptcha(enabled(provider), TOKEN)).toEqual({
				ok: true,
			});
		});

		it("posts the secret and the token form-encoded to the provider's verification URL, with no redirects", async () => {
			stubFetchJson(ok(provider));
			const config = enabled(provider);

			await verifyCaptcha(config, TOKEN);

			const [call] = sentRequests();
			expect(call?.url).toBe(config.verifyUrl);
			expect(call?.method).toBe("POST");
			expect(call?.headers.get("content-type")).toBe(
				"application/x-www-form-urlencoded",
			);
			expect([...new URLSearchParams(call?.body)]).toEqual([
				["secret", SECRET],
				["response", TOKEN],
			]);
			const init = (
				globalThis.fetch as unknown as {
					mock: { calls: [unknown, RequestInit][] };
				}
			).mock.calls[0]?.[1];
			expect(init?.redirect).toBe("error");
			expect(init?.cache).toBe("no-store");
			expect(init?.signal).toBeInstanceOf(AbortSignal);
		});

		it("refuses a token the provider rejects and keeps only its plain error codes", async () => {
			stubFetchJson({
				success: false,
				"error-codes": [
					"invalid-input-response",
					"bob@example.org",
					"timeout-or-duplicate",
				],
			});

			const verdict = await verifyCaptcha(enabled(provider), TOKEN);

			expect(verdict).toEqual({
				ok: false,
				reason: "rejected",
				detail: "invalid-input-response,timeout-or-duplicate",
			});
		});

		it("refuses, as unavailable, when the provider cannot be reached or times out", async () => {
			globalThis.fetch = mock(async () => {
				throw new DOMException("timed out", "TimeoutError");
			}) as unknown as typeof fetch;

			expect(await verifyCaptcha(enabled(provider), TOKEN)).toEqual({
				ok: false,
				reason: "unavailable",
				detail: "TimeoutError",
			});
		});

		it("refuses a non-success status without reading the body", async () => {
			stubFetchJson(ok(provider), 503);

			expect(await verifyCaptcha(enabled(provider), TOKEN)).toEqual({
				ok: false,
				reason: "unavailable",
				detail: "status-503",
			});
		});

		it("refuses an answer that is not the expected shape", async () => {
			for (const body of [
				{ success: "true" },
				{ ok: true },
				[],
				"success",
				null,
			]) {
				stubFetchJson(body);
				const verdict = await verifyCaptcha(enabled(provider), TOKEN);
				expect(verdict).toMatchObject({
					ok: false,
					reason: "unavailable",
				});
			}
			stubFetchResponse(
				new Response("<html>nope</html>", {
					headers: { "content-type": "text/html" },
				}),
			);
			expect(await verifyCaptcha(enabled(provider), TOKEN)).toMatchObject(
				{ ok: false, reason: "unavailable" },
			);
		});

		it("refuses an answer over the size cap, declared or streamed, without buffering it", async () => {
			stubFetchResponse(
				new Response("{}", {
					headers: { "content-length": String(VERIFY_MAX_BYTES + 1) },
				}),
			);
			expect(await verifyCaptcha(enabled(provider), TOKEN)).toEqual({
				ok: false,
				reason: "unavailable",
				detail: "answer-too-large",
			});

			const counter = { pulled: 0 } as {
				pulled: number;
				cancelled?: boolean;
			};
			stubFetchResponse(new Response(zeroStream(1000, 1024, counter)));
			expect(await verifyCaptcha(enabled(provider), TOKEN)).toMatchObject(
				{ reason: "unavailable" },
			);
			expect(counter.cancelled).toBe(true);
			expect(counter.pulled).toBeLessThan(40);
		});

		it("checks the host name the provider reports when the operator set one, ignoring case", async () => {
			const config = enabled(provider, {
				EPISTLE_PANEL_CAPTCHA_HOSTNAME: "panel.example.org",
			});

			stubFetchJson({ ...ok(provider), hostname: "Panel.Example.org" });
			expect(await verifyCaptcha(config, TOKEN)).toEqual({ ok: true });

			for (const hostname of [
				"evil.example",
				"panel.example.org.evil.example",
				undefined,
			]) {
				stubFetchJson({
					...ok(provider),
					...(hostname === undefined ? {} : { hostname }),
				});
				expect(await verifyCaptcha(config, TOKEN)).toEqual({
					ok: false,
					reason: "mismatch",
					detail: "hostname",
				});
			}
		});

		it("does not look at the host name when the operator set none", async () => {
			stubFetchJson({ ...ok(provider), hostname: "anything.example" });

			expect(await verifyCaptcha(enabled(provider), TOKEN)).toEqual({
				ok: true,
			});
		});

		it("never carries the token or the secret in its verdict", async () => {
			stubFetchJson({ success: false, "error-codes": [TOKEN, SECRET] });

			const text = JSON.stringify(
				await verifyCaptcha(enabled(provider), TOKEN),
			);

			expect(text).not.toContain(TOKEN);
			expect(text).not.toContain(SECRET);
		});
	});
}

describe("verifyCaptcha (Turnstile action)", () => {
	it("needs the login action the widget was asked for", async () => {
		for (const body of [
			{ success: true },
			{ success: true, action: "other" },
		]) {
			stubFetchJson(body);
			expect(await verifyCaptcha(enabled("turnstile"), TOKEN)).toEqual({
				ok: false,
				reason: "mismatch",
				detail: "action",
			});
		}
	});

	it("is not asked of providers that do not return one", async () => {
		stubFetchJson({ success: true, action: "whatever" });

		expect(await verifyCaptcha(enabled("recaptcha"), TOKEN)).toEqual({
			ok: true,
		});
	});
});

describe("verifyCaptcha (inputs and secret)", () => {
	it("refuses an empty or oversized token without calling the provider", async () => {
		stubFetchJson({ success: true });

		for (const token of ["", "t".repeat(CAPTCHA_TOKEN_MAX + 1)]) {
			expect(
				await verifyCaptcha(enabled("recaptcha"), token),
			).toMatchObject({ ok: false, reason: "rejected" });
		}
		expect(sentRequests()).toHaveLength(0);
	});

	it("accepts a token of exactly the cap", async () => {
		stubFetchJson({ success: true });

		expect(
			await verifyCaptcha(
				enabled("recaptcha"),
				"t".repeat(CAPTCHA_TOKEN_MAX),
			),
		).toEqual({ ok: true });
	});

	it("is misconfigured, naming the variable and never the path, when the secret file cannot be read", async () => {
		delete process.env[CAPTCHA_VARIABLES.secretKey];
		process.env[`${CAPTCHA_VARIABLES.secretKey}_FILE`] =
			"/nonexistent/dir/secret";
		stubFetchJson({ success: true });

		const verdict = await verifyCaptcha(enabled("recaptcha"), TOKEN);

		expect(verdict).toMatchObject({ ok: false, reason: "misconfigured" });
		expect(JSON.stringify(verdict)).toContain(
			`${CAPTCHA_VARIABLES.secretKey}_FILE`,
		);
		expect(JSON.stringify(verdict)).not.toContain("/nonexistent");
		expect(sentRequests()).toHaveLength(0);
	});

	it("is misconfigured when no secret is set at all", async () => {
		delete process.env[CAPTCHA_VARIABLES.secretKey];
		stubFetchJson({ success: true });

		expect(await verifyCaptcha(enabled("recaptcha"), TOKEN)).toMatchObject({
			ok: false,
			reason: "misconfigured",
		});
		expect(sentRequests()).toHaveLength(0);
	});

	describe("the ceiling on calls in flight", () => {
		const answer = () =>
			new Response(JSON.stringify({ success: true }), {
				headers: { "content-type": "application/json" },
			});

		// The gate is shared by the whole module: every call left hanging by a
		// case is answered afterwards, so no case leaves a slot held for the next.
		const hanging: Array<(response: Response) => void> = [];
		afterEach(async () => {
			for (let round = 0; round < 10 && hanging.length > 0; round += 1) {
				for (const resolve of hanging.splice(0)) {
					resolve(answer());
				}
				await settle();
			}
		});

		function holdAll() {
			const waiting: Array<(response: Response) => void> = [];
			globalThis.fetch = mock(
				() =>
					new Promise<Response>((resolve) => {
						waiting.push(resolve);
						hanging.push(resolve);
					}),
			) as unknown as typeof fetch;
			return waiting;
		}
		const settle = () => new Promise((resolve) => setTimeout(resolve, 10));

		it("serves a call above the ceiling when a slot frees within the wait, and sends no extra request before", async () => {
			const waiting = holdAll();
			const config = enabled("recaptcha");
			const held = Array.from({ length: VERIFY_MAX_IN_FLIGHT }, () =>
				verifyCaptcha(config, TOKEN),
			);
			await settle();
			const extra = verifyCaptcha(config, TOKEN);
			await settle();
			expect(sentRequests()).toHaveLength(VERIFY_MAX_IN_FLIGHT);

			waiting[0]?.(answer());
			await settle();
			expect(sentRequests()).toHaveLength(VERIFY_MAX_IN_FLIGHT + 1);
			for (const resolve of waiting.slice(1)) {
				resolve(answer());
			}

			expect(await extra).toEqual({ ok: true });
			expect(await Promise.all(held)).toEqual(
				Array.from({ length: VERIFY_MAX_IN_FLIGHT }, () => ({
					ok: true,
				})),
			);
		});

		it("serves a burst above the ceiling in arrival order", async () => {
			const waiting = holdAll();
			const config = enabled("recaptcha");
			const tokens = Array.from(
				{ length: VERIFY_MAX_IN_FLIGHT + 3 },
				(_, n) => `token-${n}`,
			);
			const calls = tokens.map((token) => verifyCaptcha(config, token));
			await settle();

			// Free one slot at a time; the line is served first in, first out.
			for (let freed = 0; freed < 3; freed += 1) {
				waiting[freed]?.(answer());
				await settle();
			}

			const order = sentRequests()
				.slice(VERIFY_MAX_IN_FLIGHT)
				.map(
					(request) =>
						String(request.body).match(/response=([^&]+)/)?.[1],
				);
			expect(order).toEqual(["token-16", "token-17", "token-18"]);
			for (const resolve of waiting.slice(3)) {
				resolve(answer());
			}
			await Promise.all(calls);
		});

		it("refuses a call that waited the full bounded time, still without a request", async () => {
			holdAll();
			const config = enabled("recaptcha");
			for (let n = 0; n < VERIFY_MAX_IN_FLIGHT; n += 1) {
				void verifyCaptcha(config, TOKEN);
			}
			await settle();

			const started = performance.now();
			const extra = await verifyCaptcha(config, TOKEN);
			const waited = performance.now() - started;

			expect(extra).toEqual({
				ok: false,
				reason: "unavailable",
				detail: "too-many-in-flight",
			});
			expect(waited).toBeGreaterThanOrEqual(VERIFY_QUEUE_WAIT_MS - 50);
			expect(waited).toBeLessThan(VERIFY_QUEUE_WAIT_MS + 500);
			expect(sentRequests()).toHaveLength(VERIFY_MAX_IN_FLIGHT);
		});

		it("refuses at once when the line is already at its length", async () => {
			holdAll();
			const config = enabled("recaptcha");
			for (
				let n = 0;
				n < VERIFY_MAX_IN_FLIGHT + VERIFY_QUEUE_MAX;
				n += 1
			) {
				void verifyCaptcha(config, TOKEN);
			}
			await settle();

			const started = performance.now();
			const extra = await verifyCaptcha(config, TOKEN);

			expect(extra).toMatchObject({ detail: "too-many-in-flight" });
			expect(performance.now() - started).toBeLessThan(200);
		});

		it("always gives the slot back, on a failed call and on a timeout", async () => {
			const config = enabled("recaptcha");
			globalThis.fetch = mock(() =>
				Promise.reject(new Error("boom")),
			) as unknown as typeof fetch;
			for (let n = 0; n < VERIFY_MAX_IN_FLIGHT * 2; n += 1) {
				expect(await verifyCaptcha(config, TOKEN)).toMatchObject({
					reason: "unavailable",
					detail: "Error",
				});
			}
			globalThis.fetch = mock(() =>
				Promise.reject(new DOMException("timed out", "TimeoutError")),
			) as unknown as typeof fetch;
			for (let n = 0; n < VERIFY_MAX_IN_FLIGHT * 2; n += 1) {
				expect(await verifyCaptcha(config, TOKEN)).toMatchObject({
					reason: "unavailable",
					detail: "TimeoutError",
				});
			}

			stubFetchJson({ success: true });
			expect(await verifyCaptcha(config, TOKEN)).toEqual({ ok: true });
		});
	});
});
