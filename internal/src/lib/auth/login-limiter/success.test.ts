import { beforeEach, expect, it } from "bun:test";
import { admitAttempt, type Outcome, resetLoginLimiter } from ".";

const NOW = 1_000_000;
beforeEach(resetLoginLimiter);

function attempt(name = "ops", at = NOW, outcome: Outcome = "success") {
	const admission = admitAttempt(name, at);
	expect(admission.allowed).toBe(true);
	if (admission.allowed) admission.settle(outcome, at);
}

function successes(count: number, name = "ops", at = NOW) {
	for (let i = 0; i < count; i++) attempt(name, at);
}

it("admits twenty successes and refuses the twenty-first", () => {
	successes(20);
	expect(admitAttempt("ops", NOW)).toEqual({
		allowed: false,
		retryAfterMs: 600_000,
	});
});

it("reopens exactly ten minutes after the first success, without extending on retries", () => {
	successes(1);
	successes(19, "ops", NOW + 10_000);
	expect(admitAttempt("ops", NOW + 599_999)).toEqual({
		allowed: false,
		retryAfterMs: 1,
	});
	successes(20, "ops", NOW + 600_000);
	expect(admitAttempt("ops", NOW + 600_000).allowed).toBe(false);
});

it("shares the success budget across normalized spellings of one name", () => {
	successes(20);
	expect(admitAttempt("  ＯＰＳ　", NOW).allowed).toBe(false);
});

it("keeps a different account's success budget independent", () => {
	successes(20);
	successes(20, "other");
	expect(admitAttempt("other", NOW).allowed).toBe(false);
});

it("does not charge failed credentials or API errors to the success budget", () => {
	successes(19);
	attempt("ops", NOW, "failure");
	attempt("ops", NOW, "error");
	attempt();
	expect(admitAttempt("ops", NOW).allowed).toBe(false);
});

it("reserves the last success slot until a pending call settles, only once", () => {
	successes(19);
	const pending = admitAttempt("ops", NOW);
	expect(pending.allowed).toBe(true);
	expect(admitAttempt("ops", NOW).allowed).toBe(false);
	if (!pending.allowed) throw new Error("expected admission");
	pending.settle("error", NOW);
	pending.settle("success", NOW);
	attempt();
	expect(admitAttempt("ops", NOW).allowed).toBe(false);
});
