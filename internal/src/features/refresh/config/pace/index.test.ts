import { expect, it } from "bun:test";
import {
	DEFAULT_REFRESH_PACE,
	isRefreshPace,
	MIN_FAST_REFRESH_MS,
	parseRefreshPace,
	REFRESH_COOKIE,
	REFRESH_COOKIE_PATH,
	REFRESH_PACES,
	refreshInterval,
} from ".";

it("is the closed list of three paces, normal by default, and there is no off", () => {
	expect([...REFRESH_PACES]).toEqual(["normal", "slow", "fast"]);
	expect(DEFAULT_REFRESH_PACE).toBe("normal");
	expect([REFRESH_COOKIE, REFRESH_COOKIE_PATH]).toEqual(["refresh", "/app"]);
	for (const off of ["off", "never", "none", "0", "false", ""]) {
		expect(isRefreshPace(off)).toBe(false);
	}
});
it("recognizes only the three literal paces and defaults untrusted input to normal", () => {
	for (const pace of REFRESH_PACES) {
		expect(isRefreshPace(pace)).toBe(true);
		expect(parseRefreshPace(pace)).toBe(pace);
	}
	for (const value of [
		undefined,
		null,
		1,
		{},
		"FAST",
		" slow ",
		"off",
		"__proto__",
		"<img>",
	]) {
		expect(isRefreshPace(value)).toBe(false);
		expect(parseRefreshPace(value)).toBe("normal");
	}
});
it("keeps normal exactly, doubles slow and halves fast", () => {
	for (const base of [15_000, 30_000, 60_000, 120_000]) {
		expect(refreshInterval(base, "normal")).toBe(base);
		expect(refreshInterval(base, "slow")).toBe(base * 2);
	}
	expect(refreshInterval(60_000, "fast")).toBe(30_000);
	expect(refreshInterval(30_000, "fast")).toBe(15_000);
});
it("never takes fast under fifteen seconds, and never turns a pace into no refresh", () => {
	expect(MIN_FAST_REFRESH_MS).toBe(15_000);
	for (const base of [1, 1_000, 7_000, 14_999, 15_000]) {
		expect(refreshInterval(base, "fast")).toBe(15_000);
	}
	for (const pace of REFRESH_PACES) {
		for (const base of [15_000, 30_000]) {
			const interval = refreshInterval(base, pace);
			expect(Number.isFinite(interval)).toBe(true);
			expect(interval).toBeGreaterThanOrEqual(15_000);
		}
	}
});
it("gives the interval each panel list has today at the normal pace, and the ones the other two make", () => {
	// mail, suppression and deliveries 30 s; status and queue 15 s.
	const table = {
		30000: { normal: 30_000, slow: 60_000, fast: 15_000 },
		15000: { normal: 15_000, slow: 30_000, fast: 15_000 },
	} as const;
	for (const [base, expected] of Object.entries(table)) {
		for (const pace of REFRESH_PACES) {
			expect(refreshInterval(Number(base), pace)).toBe(expected[pace]);
		}
	}
});
