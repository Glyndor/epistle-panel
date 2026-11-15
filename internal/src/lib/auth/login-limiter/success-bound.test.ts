import { afterEach, beforeEach, expect, it } from "bun:test";
import {
	admitAttempt,
	MAX_TRACKED_SUCCESSES,
	resetLoginLimiter,
	SUCCESS_MAX_SIGN_INS,
	SUCCESS_WINDOW_MS,
	trackedSuccesses,
} from ".";

const NOW = 1_000_000;
beforeEach(resetLoginLimiter);
afterEach(resetLoginLimiter);

function succeed(name: string, at = NOW, count = 1) {
	for (let i = 0; i < count; i++) {
		const admission = admitAttempt(name, at);
		expect(admission.allowed).toBe(true);
		if (admission.allowed) admission.settle("success", at);
	}
}

function fill(at = NOW, count = MAX_TRACKED_SUCCESSES - 1) {
	for (let i = 0; i < count; i++) succeed(`other-${i}`, at);
}

it("bounds success records across many distinct names", () => {
	expect(MAX_TRACKED_SUCCESSES).toBe(1_000);
	for (let i = 0; i < MAX_TRACKED_SUCCESSES * 3; i++) {
		succeed(`name-${i}`);
		expect(trackedSuccesses()).toBe(Math.min(i + 1, 1_000));
	}
});

it("starts a dropped name again from zero", () => {
	succeed("first", NOW, SUCCESS_MAX_SIGN_INS);
	fill(NOW + 1);
	succeed("overflow", NOW + 2);
	succeed("first", NOW + 3, SUCCESS_MAX_SIGN_INS);
	expect(admitAttempt("first", NOW + 3).allowed).toBe(false);
});

it("drops the oldest window start rather than the oldest insertion", () => {
	// Explicit times model a wall-clock adjustment: insertion order alone
	// cannot tell which fixed window started first.
	succeed("inserted-first", NOW + 100, SUCCESS_MAX_SIGN_INS);
	succeed("oldest-window", NOW, SUCCESS_MAX_SIGN_INS);
	fill(NOW + 100, MAX_TRACKED_SUCCESSES - 2);
	succeed("overflow", NOW + 101);
	expect(admitAttempt("inserted-first", NOW + 102).allowed).toBe(false);
	succeed("oldest-window", NOW + 102, SUCCESS_MAX_SIGN_INS);
});

it("prunes finished windows before dropping any live budget", () => {
	succeed("expired-one");
	succeed("expired-two");
	succeed("live", NOW + 1, SUCCESS_MAX_SIGN_INS);
	fill(NOW + 1, MAX_TRACKED_SUCCESSES - 3);
	succeed("new", NOW + SUCCESS_WINDOW_MS);
	expect(trackedSuccesses()).toBe(MAX_TRACKED_SUCCESSES - 1);
	expect(admitAttempt("live", NOW + SUCCESS_WINDOW_MS)).toEqual({
		allowed: false,
		retryAfterMs: 1,
	});
});

it("preserves the success ceiling of a name that is not dropped", () => {
	succeed("oldest");
	succeed("retained", NOW + 1, SUCCESS_MAX_SIGN_INS - 1);
	fill(NOW + 1, MAX_TRACKED_SUCCESSES - 2);
	succeed("overflow", NOW + 2);
	succeed("retained", NOW + 3);
	expect(admitAttempt("retained", NOW + 3)).toEqual({
		allowed: false,
		retryAfterMs: SUCCESS_WINDOW_MS - 2,
	});
});
