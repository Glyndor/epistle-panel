import { afterEach, beforeEach, expect, it, mock } from "bun:test";
import { resetLoginLimiter } from "@/lib/auth/login-limiter";
import {
	followRedirect,
	mockRequestCookies,
} from "@/lib/auth/test-support/cookies";
import { timeIt, useFakeClock, useRealClock } from "@/test/fake-clock";

const cookies = mockRequestCookies();
const { login } = await import(".");
const originalFetch = globalThis.fetch;

beforeEach(() => {
	cookies.reset();
	resetLoginLimiter();
	useFakeClock();
	process.env["EPISTLE_PANEL_LOGIN_MIN_MS"] = "300";
});
afterEach(() => {
	globalThis.fetch = originalFetch;
	delete process.env["EPISTLE_PANEL_LOGIN_MIN_MS"];
	useRealClock();
});

it("throttles correct and wrong passwords equally before Epistle after twenty sign-ins", async () => {
	const fetch = mock(
		async () => new Response(JSON.stringify({ valid: true, admin: false })),
	);
	globalThis.fetch = fetch as unknown as typeof globalThis.fetch;
	const form = (password: string) => {
		const data = new FormData();
		data.set("name", "ops");
		data.set("password", password);
		return data;
	};
	for (let i = 0; i < 20; i++) {
		await timeIt(() =>
			followRedirect(login({ outcome: "idle" }, form("right"))),
		);
	}
	for (const password of ["right", "wrong"]) {
		const result = await timeIt(() =>
			login({ outcome: "idle" }, form(password)),
		);
		expect(result.value).toEqual({ outcome: "throttled" });
		expect(result.elapsedMs).toBe(300);
	}
	expect(fetch).toHaveBeenCalledTimes(20);
	expect(cookies.writes).toHaveLength(20);
});
