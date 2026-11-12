import { beforeEach, describe, expect, it } from "bun:test";

import {
	type Admission,
	admitAttempt,
	attemptsInFlight,
	BASE_LOCK_MS,
	FREE_ATTEMPTS,
	GLOBAL_MAX_FAILURES,
	GLOBAL_WINDOW_MS,
	KNOWN_GOOD_MS,
	MAX_IN_FLIGHT,
	MAX_KNOWN_GOOD_NAMES,
	MAX_LOCK_MS,
	MAX_TRACKED_NAMES,
	type Outcome,
	resetLoginLimiter,
	trackedNames,
} from ".";

beforeEach(resetLoginLimiter);

const T0 = 1_000_000;

/** Admit one attempt for `name` at `now` and report `outcome` for it at once. */
function attempt(
	name: string,
	now: number,
	outcome: Outcome = "failure",
): Admission {
	const admission = admitAttempt(name, now);
	if (admission.allowed) {
		admission.settle(outcome, now);
	}
	return admission;
}

/** Admit `count` attempts for `name` at `now`, expecting each to pass. */
function pass(name: string, count: number, now: number): void {
	for (let i = 0; i < count; i++) {
		expect(attempt(name, now).allowed).toBe(true);
	}
}

describe("per-name backoff", () => {
	it("admits the free attempts and then locks the name", () => {
		pass("ops", FREE_ATTEMPTS + 1, T0);

		expect(admitAttempt("ops", T0 + 1)).toEqual({
			allowed: false,
			retryAfterMs: BASE_LOCK_MS - 1,
		});
	});

	it("doubles the lock on each attempt past the free ones", () => {
		pass("ops", FREE_ATTEMPTS + 1, T0);
		pass("ops", 1, T0 + BASE_LOCK_MS);

		expect(admitAttempt("ops", T0 + BASE_LOCK_MS + 1)).toEqual({
			allowed: false,
			retryAfterMs: BASE_LOCK_MS * 2 - 1,
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

		expect(attempt("other", T0 + 1).allowed).toBe(true);
		expect(admitAttempt("  OPS ", T0 + 1).allowed).toBe(false);
	});

	it("clears a name on success", () => {
		pass("ops", FREE_ATTEMPTS, T0);
		attempt("ops", T0, "success");

		pass("ops", FREE_ATTEMPTS + 1, T0 + 1);
	});
});

describe("a lock ends with its chain", () => {
	interface Run {
		/** End of every lock the attacker ran into. */
		lockEnds: number[];
	}

	/** Fail `name` the instant each lock expires, like a patient attacker. */
	function hammer(name: string, until: number): Run {
		const run: Run = { lockEnds: [] };
		let now = T0;
		while (now < until) {
			const next = admitAttempt(name, now);
			if (next.allowed) {
				next.settle("failure", now);
				now += 1;
			} else {
				run.lockEnds.push(now + next.retryAfterMs);
				now += next.retryAfterMs;
			}
		}
		return run;
	}

	it("lets the right password in as soon as the chain is over, whatever the attacker did", () => {
		// With a lock renewed by each admitted attempt this stays refused.
		hammer("admin", T0 + MAX_LOCK_MS);

		expect(attempt("admin", T0 + MAX_LOCK_MS, "success").allowed).toBe(
			true,
		);
	});

	it("never locks a name beyond the end of its first chain", () => {
		const run = hammer("admin", T0 + MAX_LOCK_MS - 1);

		expect(Math.max(...run.lockEnds)).toBeLessThanOrEqual(T0 + MAX_LOCK_MS);
	});

	it("starts a clean chain once MAX_LOCK_MS has passed since the first attempt", () => {
		pass("admin", FREE_ATTEMPTS + 1, T0);
		const lateness = T0 + MAX_LOCK_MS;

		pass("admin", FREE_ATTEMPTS + 1, lateness);
		expect(admitAttempt("admin", lateness + 1).allowed).toBe(false);
	});

	it("does not let one request per chain hold a name", () => {
		// A single failing request every MAX_LOCK_MS never builds a lock at all.
		for (let i = 0; i < 20; i++) {
			expect(attempt("admin", T0 + i * MAX_LOCK_MS).allowed).toBe(true);
		}
		expect(attempt("admin", T0 + 20 * MAX_LOCK_MS, "success").allowed).toBe(
			true,
		);
	});

	it("admits a bounded number of attempts per chain", () => {
		let now = T0;
		let admitted = 0;
		while (now < T0 + MAX_LOCK_MS) {
			const next = admitAttempt("admin", now);
			if (next.allowed) {
				next.settle("failure", now);
				admitted += 1;
				now += 1;
			} else {
				now += next.retryAfterMs;
			}
		}

		expect(admitted).toBeLessThanOrEqual(FREE_ATTEMPTS + 10);
		expect(admitted).toBeGreaterThan(FREE_ATTEMPTS);
	});
});

describe("global ceiling on failures", () => {
	it("refuses unknown names once the failure window is full, then reopens", () => {
		for (let i = 0; i < GLOBAL_MAX_FAILURES; i++) {
			expect(attempt(`name-${i}`, T0).allowed).toBe(true);
		}

		expect(admitAttempt("someone-new", T0 + 5)).toEqual({
			allowed: false,
			retryAfterMs: GLOBAL_WINDOW_MS - 5,
		});
		expect(admitAttempt("someone-new", T0 + GLOBAL_WINDOW_MS).allowed).toBe(
			true,
		);
	});

	it("does not count successes or failed calls", () => {
		for (let i = 0; i < GLOBAL_MAX_FAILURES * 2; i++) {
			attempt(`ok-${i}`, T0, "success");
			attempt(`down-${i}`, T0, "error");
		}

		expect(attempt("fresh", T0 + 1).allowed).toBe(true);
	});

	it("keeps a name that signed in earlier out of a flood of failing names", () => {
		attempt("admin", T0, "success");
		for (let i = 0; i < GLOBAL_MAX_FAILURES; i++) {
			attempt(`burn-${i}`, T0 + 1);
		}

		expect(admitAttempt("burn-new", T0 + 2).allowed).toBe(false);
		expect(attempt("admin", T0 + 2, "success").allowed).toBe(true);
	});

	it("forgets a signed-in name after KNOWN_GOOD_MS and bounds the set", () => {
		attempt("admin", T0, "success");
		const later = T0 + KNOWN_GOOD_MS + 1;
		for (let i = 0; i < GLOBAL_MAX_FAILURES; i++) {
			attempt(`burn-${i}`, later);
		}
		expect(admitAttempt("admin", later + 1).allowed).toBe(false);

		resetLoginLimiter();
		for (let i = 0; i < MAX_KNOWN_GOOD_NAMES + 5; i++) {
			attempt(`good-${i}`, T0, "success");
		}
		for (let i = 0; i < GLOBAL_MAX_FAILURES; i++) {
			attempt(`burn-${i}`, T0 + 1);
		}
		expect(admitAttempt("good-0", T0 + 2).allowed).toBe(false);
		expect(admitAttempt("good-5", T0 + 2).allowed).toBe(true);
	});

	it("still applies the name's own lock to a signed-in name", () => {
		attempt("admin", T0, "success");
		pass("admin", FREE_ATTEMPTS + 1, T0 + 1);

		expect(admitAttempt("admin", T0 + 2).allowed).toBe(false);
	});
});

describe("concurrent attempts", () => {
	it("refuses attempts beyond MAX_IN_FLIGHT until one settles", () => {
		const held: Admission[] = [];
		for (let i = 0; i < MAX_IN_FLIGHT; i++) {
			const admission = admitAttempt(`slow-${i}`, T0);
			expect(admission.allowed).toBe(true);
			held.push(admission);
		}
		expect(attemptsInFlight()).toBe(MAX_IN_FLIGHT);

		expect(admitAttempt("one-more", T0).allowed).toBe(false);
		const first = held[0];
		if (first?.allowed) {
			first.settle("error", T0);
		}

		expect(admitAttempt("one-more", T0).allowed).toBe(true);
	});

	it("frees the slot once, however often settle is called", () => {
		const admission = admitAttempt("ops", T0);
		if (!admission.allowed) {
			throw new Error("expected the attempt to be admitted");
		}
		admission.settle("failure", T0);
		admission.settle("failure", T0);
		admission.settle("success", T0);

		expect(attemptsInFlight()).toBe(0);
		// Only the first report counted: one failure, no success.
		for (let i = 0; i < GLOBAL_MAX_FAILURES - 1; i++) {
			attempt(`burn-${i}`, T0);
		}
		expect(admitAttempt("ops-2", T0).allowed).toBe(false);
	});

	it("does not count a refused attempt against its name", () => {
		for (let i = 0; i < MAX_IN_FLIGHT; i++) {
			admitAttempt(`slow-${i}`, T0);
		}
		for (let i = 0; i < 10; i++) {
			expect(admitAttempt("ops", T0).allowed).toBe(false);
		}
		resetLoginLimiter();

		pass("ops", FREE_ATTEMPTS + 1, T0);
	});
});

describe("memory bound", () => {
	it("keeps at most MAX_TRACKED_NAMES names", () => {
		for (let i = 0; i < MAX_TRACKED_NAMES + 50; i++) {
			// A new window each time so the global ceiling does not interfere.
			attempt(`name-${i}`, T0 + i * GLOBAL_WINDOW_MS);
		}

		expect(trackedNames()).toBeLessThanOrEqual(MAX_TRACKED_NAMES);
	});
});

describe("limits, in literals", () => {
	// The numbers are written out on purpose: a test that reads a limit from the
	// module it checks agrees with whatever the module says, so changing the
	// limit would change the oracle with it.
	const MINUTE = 60_000;
	const EIGHT_HOURS = 8 * 60 * MINUTE;

	it("keeps the documented values", () => {
		expect({
			FREE_ATTEMPTS,
			BASE_LOCK_MS,
			MAX_LOCK_MS,
			GLOBAL_WINDOW_MS,
			GLOBAL_MAX_FAILURES,
			MAX_IN_FLIGHT,
			KNOWN_GOOD_MS,
			MAX_TRACKED_NAMES,
			MAX_KNOWN_GOOD_NAMES,
		}).toEqual({
			FREE_ATTEMPTS: 3,
			BASE_LOCK_MS: 2_000,
			MAX_LOCK_MS: 900_000,
			GLOBAL_WINDOW_MS: 60_000,
			GLOBAL_MAX_FAILURES: 60,
			MAX_IN_FLIGHT: 8,
			KNOWN_GOOD_MS: 28_800_000,
			MAX_TRACKED_NAMES: 10_000,
			MAX_KNOWN_GOOD_NAMES: 1_000,
		});
	});

	it("locks a name for 2 s after its fourth attempt and doubles it for the fifth", () => {
		for (let i = 0; i < 4; i++) {
			expect(attempt("ops", T0).allowed).toBe(true);
		}
		expect(admitAttempt("ops", T0)).toEqual({
			allowed: false,
			retryAfterMs: 2_000,
		});

		expect(attempt("ops", T0 + 2_000).allowed).toBe(true);
		expect(admitAttempt("ops", T0 + 2_000)).toEqual({
			allowed: false,
			retryAfterMs: 4_000,
		});
	});

	it("refuses the 61st failing name in a minute and not the 60th", () => {
		for (let i = 0; i < 59; i++) {
			attempt(`name-${i}`, T0);
		}
		expect(attempt("name-59", T0).allowed).toBe(true);

		expect(admitAttempt("name-60", T0)).toEqual({
			allowed: false,
			retryAfterMs: 60_000,
		});
		expect(admitAttempt("name-60", T0 + MINUTE - 1).allowed).toBe(false);
		expect(admitAttempt("name-60", T0 + MINUTE).allowed).toBe(true);
	});

	it("exempts a signed-in name from the ceiling for eight hours, not a millisecond more", () => {
		const burn = (at: number) => {
			for (let i = 0; i < 60; i++) {
				attempt(`burn-${i}`, at);
			}
		};

		attempt("admin", T0, "success");
		burn(T0 + EIGHT_HOURS - 1);
		expect(admitAttempt("admin", T0 + EIGHT_HOURS - 1).allowed).toBe(true);

		resetLoginLimiter();
		attempt("admin", T0, "success");
		burn(T0 + EIGHT_HOURS);
		expect(admitAttempt("admin", T0 + EIGHT_HOURS).allowed).toBe(false);
	});

	it("drops the oldest name when the table is full of live chains", () => {
		// Four attempts lock "first"; every other name stays inside its chain,
		// so nothing is stale and the oldest record has to make room.
		for (let i = 0; i < 4; i++) {
			attempt("first", T0, "error");
		}
		expect(admitAttempt("first", T0).allowed).toBe(false);
		for (let i = 0; i < 9_999; i++) {
			attempt(`other-${i}`, T0, "error");
		}
		expect(trackedNames()).toBe(10_000);

		attempt("one-more", T0, "error");

		expect(trackedNames()).toBe(10_000);
		// "first" was the oldest record: its lock went with it.
		expect(admitAttempt("first", T0).allowed).toBe(true);
	});
});
