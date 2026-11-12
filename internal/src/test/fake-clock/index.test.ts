import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { FAKE_CLOCK_START, timeIt, useFakeClock, useRealClock } from ".";

beforeEach(useFakeClock);
afterEach(useRealClock);

describe("fake clock", () => {
	it("starts at the fixed instant and does not move by itself", async () => {
		expect(Date.now()).toBe(FAKE_CLOCK_START);
		await crypto.subtle.digest("SHA-256", new Uint8Array(1));
		expect(Date.now()).toBe(FAKE_CLOCK_START);
	});

	it("measures a timer in exact fake milliseconds", async () => {
		const run = await timeIt(
			() =>
				new Promise<string>((resolve) =>
					setTimeout(() => resolve("up"), 300),
				),
		);

		expect(run).toEqual({ value: "up", elapsedMs: 300 });
	});

	it("reports a rejection and the time it took", async () => {
		const run = await timeIt(async () => {
			await new Promise((resolve) => setTimeout(resolve, 40));
			throw new Error("boom");
		});

		expect(run.error).toBeInstanceOf(Error);
		expect(run.elapsedMs).toBe(40);
	});

	it("takes no fake time for work that needs none", async () => {
		expect((await timeIt(async () => 1)).elapsedMs).toBe(0);
	});

	it("leaves a request's own budget out of the timers and gives it back", async () => {
		useRealClock();
		const real = AbortSignal.timeout;
		useFakeClock();

		expect(AbortSignal.timeout).not.toBe(real);
		useRealClock();
		expect(AbortSignal.timeout).toBe(real);
	});
});
