import { beforeEach, describe, expect, it } from "bun:test";

import {
	admitAttempt,
	BASE_LOCK_MS,
	FREE_ATTEMPTS,
	GLOBAL_MAX_ATTEMPTS,
	GLOBAL_WINDOW_MS,
	IDLE_FORGET_MS,
	MAX_LOCK_MS,
	MAX_TRACKED_NAMES,
	recordSuccess,
	resetLoginLimiter,
	trackedNames,
} from ".";

beforeEach(resetLoginLimiter);

const T0 = 1_000_000;

/** Admit `count` attempts for `name` at `now`, expecting each to pass. */
function pass(name: string, count: number, now: number): void {
	for (let i = 0; i < count; i++) {
		expect(admitAttempt(name, now).allowed).toBe(true);
	}
}

describe("per-name backoff", () => {
	it("admits the free attempts and then locks the name", () => {
		pass("ops", FREE_ATTEMPTS + 1, T0);

		const next = admitAttempt("ops", T0 + 1);
		expect(next).toEqual({
			allowed: false,
			retryAfterMs: BASE_LOCK_MS - 1,
		});
	});

	it("doubles the lock on each attempt past the free ones", () => {
		pass("ops", FREE_ATTEMPTS + 1, T0);
		pass("ops", 1, T0 + BASE_LOCK_MS);

		const next = admitAttempt("ops", T0 + BASE_LOCK_MS + 1);
		expect(next).toEqual({
			allowed: false,
			retryAfterMs: BASE_LOCK_MS * 2 - 1,
		});
	});

	it("caps the lock", () => {
		let now = T0;
		pass("ops", FREE_ATTEMPTS + 1, now);
		let lock = BASE_LOCK_MS;
		for (let i = 0; i < 30; i++) {
			now += lock;
			pass("ops", 1, now);
			lock = Math.min(lock * 2, MAX_LOCK_MS);
		}

		expect(admitAttempt("ops", now + 1)).toEqual({
			allowed: false,
			retryAfterMs: MAX_LOCK_MS - 1,
		});
	});

	it("does not lengthen a lock when retried during it", () => {
		pass("ops", FREE_ATTEMPTS + 1, T0);
		for (let i = 0; i < 20; i++) {
			expect(admitAttempt("ops", T0 + 10 + i).allowed).toBe(false);
		}

		expect(admitAttempt("ops", T0 + BASE_LOCK_MS).allowed).toBe(true);
	});

	it("tracks names independently and ignores case and padding", () => {
		pass("ops", FREE_ATTEMPTS + 1, T0);

		expect(admitAttempt("other", T0 + 1).allowed).toBe(true);
		expect(admitAttempt("  OPS ", T0 + 1).allowed).toBe(false);
	});

	it("clears a name on success", () => {
		pass("ops", FREE_ATTEMPTS, T0);
		recordSuccess("ops");

		pass("ops", FREE_ATTEMPTS + 1, T0 + 1);
	});

	it("forgets an idle name", () => {
		pass("ops", FREE_ATTEMPTS + 1, T0);

		const later = T0 + BASE_LOCK_MS + IDLE_FORGET_MS + 1;
		expect(admitAttempt("ops", later).allowed).toBe(true);
	});
});

describe("global ceiling", () => {
	it("refuses every name once the window is full, then reopens", () => {
		for (let i = 0; i < GLOBAL_MAX_ATTEMPTS; i++) {
			expect(admitAttempt(`name-${i}`, T0).allowed).toBe(true);
		}

		const refused = admitAttempt("someone-new", T0 + 5);
		expect(refused).toEqual({
			allowed: false,
			retryAfterMs: GLOBAL_WINDOW_MS - 5,
		});
		expect(admitAttempt("someone-new", T0 + GLOBAL_WINDOW_MS).allowed).toBe(
			true,
		);
	});

	it("gives an attempt back to the window on success", () => {
		for (let i = 0; i < GLOBAL_MAX_ATTEMPTS; i++) {
			admitAttempt(`name-${i}`, T0);
		}
		recordSuccess("name-0");

		expect(admitAttempt("fresh", T0 + 1).allowed).toBe(true);
	});
});

describe("memory bound", () => {
	it("keeps at most MAX_TRACKED_NAMES names", () => {
		for (let i = 0; i < MAX_TRACKED_NAMES + 50; i++) {
			// A new window each time so the global ceiling does not interfere.
			admitAttempt(`name-${i}`, T0 + i * GLOBAL_WINDOW_MS);
		}

		expect(trackedNames()).toBeLessThanOrEqual(MAX_TRACKED_NAMES);
	});
});
