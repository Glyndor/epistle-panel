import { afterEach, describe, expect, it } from "bun:test";

import {
	holdUntilFloor,
	LOGIN_RESPONSE_FLOOR_MS,
	loginResponseFloorMs,
	MAX_LOGIN_RESPONSE_FLOOR_MS,
} from ".";

afterEach(() => {
	delete process.env.EPISTLE_PANEL_LOGIN_MIN_MS;
});

describe("holdUntilFloor", () => {
	it("waits until the floor has passed since the start", async () => {
		const startedAt = Date.now();

		await holdUntilFloor(startedAt, 120);

		expect(Date.now() - startedAt).toBeGreaterThanOrEqual(115);
	});

	it("returns at once when the floor is already gone", async () => {
		const before = performance.now();

		await holdUntilFloor(Date.now() - 500, 100);

		expect(performance.now() - before).toBeLessThan(50);
	});

	it("reads the floor from the environment when none is passed", async () => {
		process.env.EPISTLE_PANEL_LOGIN_MIN_MS = "150";
		const startedAt = Date.now();

		await holdUntilFloor(startedAt);

		expect(Date.now() - startedAt).toBeGreaterThanOrEqual(145);
	});
});

describe("loginResponseFloorMs", () => {
	it("defaults to one second", () => {
		expect(loginResponseFloorMs()).toBe(LOGIN_RESPONSE_FLOOR_MS);
		expect(LOGIN_RESPONSE_FLOOR_MS).toBe(1000);
	});

	it("takes a whole number of milliseconds from the environment", () => {
		process.env.EPISTLE_PANEL_LOGIN_MIN_MS = " 2500 ";
		expect(loginResponseFloorMs()).toBe(2500);

		process.env.EPISTLE_PANEL_LOGIN_MIN_MS = "0";
		expect(loginResponseFloorMs()).toBe(0);
	});

	it("falls back to the default for anything else", () => {
		for (const bad of [
			"",
			"abc",
			"-5",
			"1.5",
			"1e3",
			"0x10",
			String(MAX_LOGIN_RESPONSE_FLOOR_MS + 1),
			"999999",
		]) {
			process.env.EPISTLE_PANEL_LOGIN_MIN_MS = bad;
			expect(loginResponseFloorMs()).toBe(LOGIN_RESPONSE_FLOOR_MS);
		}
	});

	it("accepts the largest allowed value", () => {
		process.env.EPISTLE_PANEL_LOGIN_MIN_MS = String(
			MAX_LOGIN_RESPONSE_FLOOR_MS,
		);

		expect(loginResponseFloorMs()).toBe(MAX_LOGIN_RESPONSE_FLOOR_MS);
	});
});
