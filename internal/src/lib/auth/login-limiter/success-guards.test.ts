import { beforeEach, expect, it } from "bun:test";
import { admitAttempt, resetLoginLimiter } from ".";

const NOW = 1_000_000;
beforeEach(resetLoginLimiter);

it("keeps known-good exemption from the global ceiling within the success budget", () => {
	for (let i = 0; i < 19; i++) {
		const admission = admitAttempt("ops", NOW);
		expect(admission.allowed).toBe(true);
		if (admission.allowed) admission.settle("success", NOW);
	}
	for (let i = 0; i < 60; i++) {
		const admission = admitAttempt(`bad-${i}`, NOW);
		expect(admission.allowed).toBe(true);
		if (admission.allowed) admission.settle("failure", NOW);
	}
	expect(admitAttempt("unknown", NOW).allowed).toBe(false);
	const last = admitAttempt("ops", NOW);
	expect(last.allowed).toBe(true);
	if (last.allowed) last.settle("success", NOW);
	expect(admitAttempt("ops", NOW).allowed).toBe(false);
});

it("still locks a known-good name below its success ceiling", () => {
	const first = admitAttempt("ops", NOW);
	if (!first.allowed) throw new Error("expected admission");
	first.settle("success", NOW);
	for (let i = 0; i < 4; i++) {
		const admission = admitAttempt("ops", NOW);
		expect(admission.allowed).toBe(true);
		if (admission.allowed) admission.settle("failure", NOW);
	}
	expect(admitAttempt("ops", NOW)).toEqual({
		allowed: false,
		retryAfterMs: 2_000,
	});
	expect(admitAttempt("ops", NOW + 2_000).allowed).toBe(true);
});

it("still enforces eight API slots for a known-good name", () => {
	const first = admitAttempt("ops", NOW);
	if (!first.allowed) throw new Error("expected admission");
	first.settle("success", NOW);
	for (let i = 0; i < 8; i++) {
		expect(admitAttempt(`pending-${i}`, NOW).allowed).toBe(true);
	}
	expect(admitAttempt("ops", NOW).allowed).toBe(false);
});
