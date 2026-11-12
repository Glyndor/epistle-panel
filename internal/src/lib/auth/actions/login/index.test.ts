import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

import {
	FREE_ATTEMPTS,
	GLOBAL_MAX_FAILURES,
	MAX_IN_FLIGHT,
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
	// Tests that are not about timing do not wait for the minimum response time.
	process.env.EPISTLE_PANEL_LOGIN_MIN_MS = "0";
});
afterEach(() => {
	globalThis.fetch = originalFetch;
	delete process.env.EPISTLE_PANEL_LOGIN_MIN_MS;
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
	const FLOOR_MS = 300;
	const SLOW_API_MS = 150;

	/** Run a sign-in and return how long it took, whatever its outcome. */
	async function timed(name: string): Promise<number> {
		const started = Date.now();
		await login(INITIAL, form(name, "pw")).catch(() => {});
		return Date.now() - started;
	}

	/** Stub an API that takes `delayMs` to answer, like a slow password hash. */
	function stubSlowVerify(
		delayMs: number,
		answer: (name: string) => { valid: boolean; admin: boolean },
	): void {
		stubVerify((name) => answer(name));
		const fast = globalThis.fetch;
		globalThis.fetch = (async (...args: Parameters<typeof fetch>) => {
			await new Promise((resolve) => setTimeout(resolve, delayMs));
			return fast(...args);
		}) as typeof fetch;
	}

	beforeEach(() => {
		process.env.EPISTLE_PANEL_LOGIN_MIN_MS = String(FLOOR_MS);
	});

	it("holds every kind of failure to the minimum time", async () => {
		const failures: Array<() => void> = [
			() => stubVerify(() => ({ valid: false, admin: false })),
			() => stubVerify(() => ({ valid: true, admin: false })),
			() => stubVerify(() => new Error("down")),
		];
		for (const arrange of failures) {
			resetLoginLimiter();
			arrange();

			expect(await timed("ops")).toBeGreaterThanOrEqual(FLOOR_MS - 20);
		}
	});

	it("holds a success to the same minimum time", async () => {
		stubVerify(() => ({ valid: true, admin: true }));

		expect(await timed("ops")).toBeGreaterThanOrEqual(FLOOR_MS - 20);
	});

	it("takes the same time for an existing account with a wrong password, an unknown account and a success", async () => {
		// The existing account pays a slow hash; the unknown one answers at once.
		// Both stay inside the floor, so all three outcomes take about as long.
		stubSlowVerify(SLOW_API_MS, () => ({ valid: false, admin: false }));
		const wrongPassword = await timed("ops");
		stubVerify(() => ({ valid: false, admin: false }));
		const unknown = await timed("ghost");
		stubSlowVerify(SLOW_API_MS, () => ({ valid: true, admin: true }));
		const success = await timed("admin");

		for (const took of [wrongPassword, unknown, success]) {
			expect(took).toBeGreaterThanOrEqual(FLOOR_MS - 20);
		}
		expect(Math.abs(wrongPassword - unknown)).toBeLessThan(SLOW_API_MS);
		expect(Math.abs(success - unknown)).toBeLessThan(SLOW_API_MS);
	});

	it("does not add the floor on top of an API that is already slower", async () => {
		stubSlowVerify(FLOOR_MS + 100, () => ({ valid: false, admin: false }));

		const took = await timed("ops");

		expect(took).toBeGreaterThanOrEqual(FLOOR_MS + 80);
		expect(took).toBeLessThan(FLOOR_MS + 100 + FLOOR_MS);
	});

	it("holds a refused attempt to the same minimum", async () => {
		stubVerify(() => ({ valid: false, admin: false }));
		await Promise.all(
			Array.from({ length: FREE_ATTEMPTS + 1 }, () =>
				login(INITIAL, form("locked", "pw")),
			),
		);
		const refusedAt = Date.now();
		const refused = await login(INITIAL, form("locked", "pw"));

		expect(refused).toEqual({ error: true, throttled: true });
		expect(Date.now() - refusedAt).toBeGreaterThanOrEqual(FLOOR_MS - 20);
	});
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

	it("applies a global ceiling to failures across many different names", async () => {
		stubVerify(() => ({ valid: false, admin: false }));

		const results = [];
		for (let i = 0; i < GLOBAL_MAX_FAILURES + 10; i++) {
			results.push(await login(INITIAL, form(`name-${i}`, "pw")));
		}

		expect(verify).toHaveBeenCalledTimes(GLOBAL_MAX_FAILURES);
		expect(results.filter((r) => r.throttled)).toHaveLength(10);
	}, 15_000);

	it("does not let a flood of failing names keep out an admin who signed in before", async () => {
		stubVerify((name, password) => ({
			valid: name === "admin" && password === "right",
			admin: true,
		}));
		await login(INITIAL, form("admin", "right")).catch(() => {});
		for (let i = 0; i < GLOBAL_MAX_FAILURES; i++) {
			await login(INITIAL, form(`burn-${i}`, "pw"));
		}
		expect(await login(INITIAL, form("burn-extra", "pw"))).toEqual({
			error: true,
			throttled: true,
		});

		const outcome = await login(INITIAL, form("admin", "right")).catch(
			(e) => e,
		);

		expect(outcome).toBeInstanceOf(RedirectSignal);
	}, 15_000);

	it("never has more than MAX_IN_FLIGHT calls waiting on the API", async () => {
		let waiting = 0;
		let peak = 0;
		stubVerify(() => ({ valid: false, admin: false }));
		const fast = globalThis.fetch;
		globalThis.fetch = (async (...args: Parameters<typeof fetch>) => {
			waiting += 1;
			peak = Math.max(peak, waiting);
			await new Promise((resolve) => setTimeout(resolve, 30));
			waiting -= 1;
			return fast(...args);
		}) as typeof fetch;

		const results = await Promise.all(
			Array.from({ length: MAX_IN_FLIGHT + 12 }, (_, i) =>
				login(INITIAL, form(`name-${i}`, "pw")),
			),
		);

		expect(peak).toBe(MAX_IN_FLIGHT);
		expect(verify).toHaveBeenCalledTimes(MAX_IN_FLIGHT);
		expect(results.filter((r) => r.throttled)).toHaveLength(12);

		// The slots are free again once the answers are in.
		expect(await login(INITIAL, form("after", "pw"))).toEqual({
			error: true,
		});
	}, 15_000);

	it("frees the slot when the API call fails", async () => {
		stubVerify(() => new Error("down"));
		for (let i = 0; i < MAX_IN_FLIGHT * 2; i++) {
			expect(await login(INITIAL, form(`name-${i}`, "pw"))).toEqual({
				error: true,
			});
		}
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
