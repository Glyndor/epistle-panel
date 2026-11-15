import { afterEach, beforeEach, expect, it } from "bun:test";
import { mockRequestCookies } from "@/lib/auth/test-support/cookies";

const cookies = mockRequestCookies();
const PACE = "EPISTLE_PANEL_REFRESH";
const IDLE = "EPISTLE_PANEL_SESSION_IDLE_TIMEOUT_MINUTES";
const saved = { pace: process.env[PACE], idle: process.env[IDLE] };
const {
	isRefreshPaceDegraded,
	readChosenRefreshPace,
	readEffectiveRefreshPace,
} = await import(".");
beforeEach(() => {
	cookies.reset();
	delete process.env[PACE];
	delete process.env[IDLE];
});
afterEach(() => {
	cookies.reset();
	for (const [key, value] of [
		[PACE, saved.pace],
		[IDLE, saved.idle],
	] as const) {
		if (value === undefined) delete process.env[key];
		else process.env[key] = value;
	}
});

const EXPECTED = {
	// idle minutes: [normal, slow, fast] as they run
	none: ["normal", "slow", "fast"],
	"1": ["normal", "normal", "fast"],
	"2": ["normal", "normal", "fast"],
	"3": ["normal", "slow", "fast"],
} as const;

it("runs slow as normal for an idle timeout of 1 or 2 minutes, from the person's cookie", async () => {
	for (const [idle, runs] of Object.entries(EXPECTED)) {
		if (idle === "none") delete process.env[IDLE];
		else process.env[IDLE] = idle;
		for (const [index, pace] of (
			["normal", "slow", "fast"] as const
		).entries()) {
			cookies.jar.set("refresh", pace);
			expect([idle, pace, await readEffectiveRefreshPace()]).toEqual([
				idle,
				pace,
				runs[index] as string,
			]);
			// What was chosen is still what was chosen.
			expect(await readChosenRefreshPace()).toBe(pace);
			expect(await isRefreshPaceDegraded()).toBe(runs[index] !== pace);
		}
	}
});
it("runs the operator's slow as normal under the same idle timeouts", async () => {
	cookies.jar.set("refresh", "fast");
	process.env[PACE] = "slow";
	for (const [idle, runs] of Object.entries(EXPECTED)) {
		if (idle === "none") delete process.env[IDLE];
		else process.env[IDLE] = idle;
		expect([idle, await readEffectiveRefreshPace()]).toEqual([
			idle,
			runs[1],
		]);
		expect(await readChosenRefreshPace()).toBe("slow");
		expect(await isRefreshPaceDegraded()).toBe(runs[1] !== "slow");
	}
});
