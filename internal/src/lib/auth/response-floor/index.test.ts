import { afterEach, beforeEach, describe, expect, it, jest } from "bun:test";

import { timeIt, useFakeClock, useRealClock } from "@/test/fake-clock";

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
	// Fake clock: the waits are exact fake milliseconds, so these asserts do not
	// depend on the load of the machine running them.
	beforeEach(useFakeClock);
	afterEach(useRealClock);

	it("waits until the floor has passed since the start", async () => {
		const run = await timeIt(() => holdUntilFloor(Date.now(), 120));

		expect(run.elapsedMs).toBe(120);
	});

	it("waits only for what is left of the floor", async () => {
		const run = await timeIt(() => holdUntilFloor(Date.now() - 70, 120));

		expect(run.elapsedMs).toBe(50);
	});

	it("returns at once, setting no timer, when the floor is already gone", async () => {
		const run = await timeIt(() => holdUntilFloor(Date.now() - 500, 100));

		expect(run.elapsedMs).toBe(0);
		expect(jest.getTimerCount()).toBe(0);
		expect(
			(await timeIt(() => holdUntilFloor(Date.now() - 100, 100)))
				.elapsedMs,
		).toBe(0);
	});

	it("reads the floor from the environment when none is passed", async () => {
		process.env.EPISTLE_PANEL_LOGIN_MIN_MS = "150";

		const run = await timeIt(() => holdUntilFloor(Date.now()));

		expect(run.elapsedMs).toBe(150);
	});

	it("waits one second by default", async () => {
		const run = await timeIt(() => holdUntilFloor(Date.now()));

		expect(run.elapsedMs).toBe(1000);
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
