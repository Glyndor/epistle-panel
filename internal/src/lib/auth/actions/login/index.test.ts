import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

import { LOGIN_FAILURE_FLOOR_MS } from "@/lib/auth/failure-floor";
import {
	FREE_ATTEMPTS,
	GLOBAL_MAX_ATTEMPTS,
	resetLoginLimiter,
} from "@/lib/auth/login-limiter";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/session";
import {
	mockRequestCookies,
	RedirectSignal,
} from "@/lib/auth/test-support/cookies";

const cookies = mockRequestCookies();
const { login } = await import(".");

const originalFetch = globalThis.fetch;
let verify = mock(async (_name: string, _password: string) => ({
	valid: true,
	admin: true,
}));

/** Stand in for the API's `/auth/verify`; records each call. */
function stubVerify(
	answer: (
		name: string,
		password: string,
	) => { valid: boolean; admin: boolean } | Error,
): void {
	verify = mock(async (name: string, password: string) => {
		const result = answer(name, password);
		if (result instanceof Error) {
			throw result;
		}
		return result;
	});
	globalThis.fetch = mock(
		async (_url: string | URL | Request, init?: RequestInit) => {
			const body = JSON.parse(String(init?.body)) as {
				name: string;
				password: string;
			};
			const result = await verify(body.name, body.password);
			return new Response(JSON.stringify(result), {
				headers: { "content-type": "application/json" },
			});
		},
	) as unknown as typeof fetch;
}

function form(name: string, password: string): FormData {
	const data = new FormData();
	data.set("name", name);
	data.set("password", password);
	return data;
}

const INITIAL = { error: false };

beforeEach(() => {
	cookies.reset();
	resetLoginLimiter();
});
afterEach(() => {
	globalThis.fetch = originalFetch;
});

describe("login success", () => {
	it("sets a __Host- session cookie with Secure and no Domain, then redirects", async () => {
		stubVerify(() => ({ valid: true, admin: true }));

		const outcome = await login(INITIAL, form("ops", "pw")).catch((e) => e);

		expect(outcome).toBeInstanceOf(RedirectSignal);
		expect(outcome.target).toBe("/");
		const [write] = cookies.writes;
		expect(write?.name).toBe(SESSION_COOKIE);
		expect(write?.name.startsWith("__Host-")).toBe(true);
		expect(write?.options).toMatchObject({
			httpOnly: true,
			secure: true,
			sameSite: "lax",
			path: "/",
		});
		expect(write?.options).not.toHaveProperty("domain");
		expect(await verifySession(write?.value)).toEqual({ sub: "ops" });
	});

	it("sets Secure whatever NODE_ENV says", async () => {
		stubVerify(() => ({ valid: true, admin: true }));
		const saved = process.env.NODE_ENV;
		(process.env as Record<string, string>).NODE_ENV = "development";
		try {
			await login(INITIAL, form("ops", "pw")).catch(() => {});
		} finally {
			(process.env as Record<string, string>).NODE_ENV = saved as string;
		}

		expect(cookies.writes[0]?.options).toMatchObject({ secure: true });
	});
});

describe("login failure", () => {
	it("returns a generic error for bad credentials, a non-admin and an unreachable API", async () => {
		for (const answer of [
			{ valid: false, admin: false },
			{ valid: true, admin: false },
			new Error("network"),
		]) {
			resetLoginLimiter();
			stubVerify(() => answer);

			expect(await login(INITIAL, form("ops", "pw"))).toEqual({
				error: true,
			});
		}
		expect(cookies.writes).toHaveLength(0);
	});

	it("rejects empty fields without calling the API", async () => {
		stubVerify(() => ({ valid: true, admin: true }));

		expect(await login(INITIAL, form("", "pw"))).toEqual({ error: true });
		expect(await login(INITIAL, form("ops", ""))).toEqual({ error: true });
		expect(verify).not.toHaveBeenCalled();
	});
});

describe("login timing", () => {
	it("holds every kind of failure to the minimum time", async () => {
		const failures: Array<() => void> = [
			() => stubVerify(() => ({ valid: false, admin: false })),
			() => stubVerify(() => ({ valid: true, admin: false })),
			() => stubVerify(() => new Error("down")),
		];
		for (const arrange of failures) {
			resetLoginLimiter();
			arrange();
			const started = Date.now();

			await login(INITIAL, form("ops", "pw"));

			expect(Date.now() - started).toBeGreaterThanOrEqual(
				LOGIN_FAILURE_FLOOR_MS - 20,
			);
		}
	});

	it("holds an unknown account and a refused attempt to the same minimum", async () => {
		stubVerify(() => ({ valid: false, admin: false }));
		const started = Date.now();
		await login(INITIAL, form("ghost", "pw"));
		expect(Date.now() - started).toBeGreaterThanOrEqual(
			LOGIN_FAILURE_FLOOR_MS - 20,
		);

		await Promise.all(
			Array.from({ length: FREE_ATTEMPTS + 1 }, () =>
				login(INITIAL, form("locked", "pw")),
			),
		);
		const refusedAt = Date.now();
		const refused = await login(INITIAL, form("locked", "pw"));

		expect(refused).toEqual({ error: true, throttled: true });
		expect(Date.now() - refusedAt).toBeGreaterThanOrEqual(
			LOGIN_FAILURE_FLOOR_MS - 20,
		);
	}, 15_000);
});

describe("login limiter", () => {
	it("stops calling the API once a name is locked", async () => {
		stubVerify(() => ({ valid: false, admin: false }));

		await Promise.all(
			Array.from({ length: FREE_ATTEMPTS + 1 }, (_, i) =>
				login(INITIAL, form("ops", `wrong-${i}`)),
			),
		);
		expect(verify).toHaveBeenCalledTimes(FREE_ATTEMPTS + 1);

		const refused = await login(INITIAL, form("ops", "right-password"));

		expect(refused).toEqual({ error: true, throttled: true });
		expect(verify).toHaveBeenCalledTimes(FREE_ATTEMPTS + 1);
	}, 20_000);

	it("refuses a parallel burst for one name before any response returns", async () => {
		stubVerify(() => ({ valid: false, admin: false }));

		const results = await Promise.all(
			Array.from({ length: 20 }, () => login(INITIAL, form("ops", "pw"))),
		);

		expect(verify).toHaveBeenCalledTimes(FREE_ATTEMPTS + 1);
		expect(results.filter((r) => r.throttled)).toHaveLength(
			20 - (FREE_ATTEMPTS + 1),
		);
	}, 15_000);

	it("applies a global ceiling to many different names", async () => {
		stubVerify(() => ({ valid: false, admin: false }));

		const results = await Promise.all(
			Array.from({ length: GLOBAL_MAX_ATTEMPTS + 10 }, (_, i) =>
				login(INITIAL, form(`name-${i}`, "pw")),
			),
		);

		expect(verify).toHaveBeenCalledTimes(GLOBAL_MAX_ATTEMPTS);
		expect(results.filter((r) => r.throttled)).toHaveLength(10);
	}, 15_000);

	it("clears the name after a success", async () => {
		stubVerify((_name, password) => ({
			valid: password === "right",
			admin: true,
		}));
		await Promise.all(
			Array.from({ length: FREE_ATTEMPTS }, () =>
				login(INITIAL, form("ops", "wrong")),
			),
		);

		const success = await login(INITIAL, form("ops", "right")).catch(
			(e) => e,
		);
		expect(success).toBeInstanceOf(RedirectSignal);

		// Without the reset these would hit the lock the earlier failures built.
		const after = await Promise.all(
			Array.from({ length: FREE_ATTEMPTS }, () =>
				login(INITIAL, form("ops", "wrong")),
			),
		);
		expect(after).toEqual(
			Array.from({ length: FREE_ATTEMPTS }, () => ({ error: true })),
		);
	}, 15_000);
});
