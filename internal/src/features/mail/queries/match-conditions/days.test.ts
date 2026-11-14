import { describe, expect, it } from "bun:test";

import type { EmailRecord } from "@/features/mail/jmap/responses";
import { EMPTY_CONDITIONS } from "@/features/mail/schemas/list-conditions-model";
import { type Rng, runCases } from "@/test/prng";

import { matchesConditions } from ".";

const at = (receivedAt: string): EmailRecord => ({ id: "m", receivedAt });

const kept = (
	receivedAt: string,
	after: string | null,
	before: string | null,
) => matchesConditions(at(receivedAt), { ...EMPTY_CONDITIONS, after, before });

describe("matchesConditions: after", () => {
	it("keeps the whole first day and drops the moment before it", () => {
		expect(kept("2026-11-10T00:00:00Z", "2026-11-10", null)).toBe(true);
		expect(kept("2026-11-10T00:00:00.000Z", "2026-11-10", null)).toBe(true);
		expect(kept("2026-11-09T23:59:59Z", "2026-11-10", null)).toBe(false);
		expect(kept("2026-11-09T23:59:59.999Z", "2026-11-10", null)).toBe(
			false,
		);
		expect(kept("2027-01-01T00:00:00Z", "2026-11-10", null)).toBe(true);
	});
});

describe("matchesConditions: before", () => {
	it("keeps the whole last day and drops the moment after it", () => {
		expect(kept("2026-11-10T23:59:59Z", null, "2026-11-10")).toBe(true);
		expect(kept("2026-11-10T23:59:59.999Z", null, "2026-11-10")).toBe(true);
		expect(kept("2026-11-11T00:00:00Z", null, "2026-11-10")).toBe(false);
		expect(kept("2026-11-10T00:00:00Z", null, "2026-11-10")).toBe(true);
		expect(kept("1999-01-01T00:00:00Z", null, "2026-11-10")).toBe(true);
	});
});

describe("matchesConditions: a range of days", () => {
	it("keeps a single day from its first moment to its last", () => {
		const day = "2026-11-10";
		expect(kept("2026-11-10T00:00:00Z", day, day)).toBe(true);
		expect(kept("2026-11-10T12:00:00Z", day, day)).toBe(true);
		expect(kept("2026-11-10T23:59:59Z", day, day)).toBe(true);
		expect(kept("2026-11-09T23:59:59Z", day, day)).toBe(false);
		expect(kept("2026-11-11T00:00:00Z", day, day)).toBe(false);
	});

	it("reads the day in UTC whatever offset the date is written with", () => {
		// 22:00 on the 9th at -05:00 is 03:00 on the 10th in UTC.
		expect(kept("2026-11-09T22:00:00-05:00", "2026-11-10", null)).toBe(
			true,
		);
		expect(kept("2026-11-09T22:00:00-05:00", null, "2026-11-09")).toBe(
			false,
		);
		// 01:00 on the 11th at +02:00 is 23:00 on the 10th in UTC.
		expect(kept("2026-11-11T01:00:00+02:00", null, "2026-11-10")).toBe(
			true,
		);
		expect(kept("2026-11-11T01:00:00+02:00", "2026-11-11", null)).toBe(
			false,
		);
	});

	it("keeps the first and the last day of a month and of a leap year", () => {
		expect(kept("2024-02-29T23:59:59Z", "2024-02-29", "2024-02-29")).toBe(
			true,
		);
		expect(kept("2024-03-01T00:00:00Z", null, "2024-02-29")).toBe(false);
		expect(kept("1970-01-01T00:00:00Z", "1970-01-01", null)).toBe(true);
		expect(kept("9999-12-31T23:59:59Z", null, "9999-12-31")).toBe(true);
	});
});

describe("matchesConditions: a date that does not parse", () => {
	it("is inside no range, and it does not throw", () => {
		for (const receivedAt of ["", "yesterday", "2026-13-45T99:00:00Z"]) {
			expect([
				receivedAt,
				kept(receivedAt, "1970-01-01", null),
				kept(receivedAt, null, "9999-12-31"),
				kept(receivedAt, "1970-01-01", "9999-12-31"),
			]).toEqual([receivedAt, false, false, false]);
		}
	});

	it("is kept when there is no day condition", () => {
		expect(kept("yesterday", null, null)).toBe(true);
	});
});

const DAY_MS = 86_400_000;

/** The UTC day of an instant, written again here from the epoch and not from `Date`'s own string. */
function dayOf(time: number): number {
	return Math.floor(time / DAY_MS);
}

function iso(dayNumber: number): string {
	return new Date(dayNumber * DAY_MS).toISOString().slice(0, 10);
}

describe("matchesConditions: days against a model", () => {
	it("keeps a message exactly when its UTC day is inside the range", async () => {
		const seen = { kept: 0, dropped: 0, edge: 0 };
		// From 1970 to the end of 2100, in days.
		const span = 47_847;
		await runCases("day range", 3000, (rng: Rng) => {
			const after = rng.chance(0.2) ? null : rng.int(0, span);
			const before = rng.chance(0.2)
				? null
				: rng.int(after ?? 0, Math.min(span, (after ?? 0) + 30));
			const ends = [after, before].filter((end) => end !== null);
			const anchor = ends.length > 0 ? rng.pick(ends) : rng.int(0, span);
			// Near an end of the range, often on the last or the first millisecond.
			const time =
				(anchor + rng.int(-1, 1)) * DAY_MS +
				rng.pick([0, DAY_MS - 1, rng.int(0, DAY_MS - 1)]);
			const day = dayOf(time);
			const want =
				(after === null || day >= after) &&
				(before === null || day <= before);
			const got = kept(
				new Date(time).toISOString(),
				after === null ? null : iso(after),
				before === null ? null : iso(before),
			);
			expect([new Date(time).toISOString(), after, before, got]).toEqual([
				new Date(time).toISOString(),
				after,
				before,
				want,
			]);
			seen[want ? "kept" : "dropped"]++;
			seen.edge += day === after || day === before ? 1 : 0;
		});
		expect(seen.kept).toBeGreaterThan(500);
		expect(seen.dropped).toBeGreaterThan(500);
		expect(seen.edge).toBeGreaterThan(500);
	});
});
