import { describe, expect, it } from "bun:test";

import { LIST_ORDERS } from "@/features/mail/schemas/list-conditions-model";
import { type Rng, runCases } from "@/test/prng";

import { compareBy, type SortableEmail } from ".";

type Row = SortableEmail & { readonly id: string };

const row = (id: string, receivedAt: string, size?: number): Row =>
	size === undefined ? { id, receivedAt } : { id, receivedAt, size };

const sorted = (order: (typeof LIST_ORDERS)[number], rows: readonly Row[]) =>
	[...rows].sort(compareBy(order)).map((r) => r.id);

describe("compareBy: newest and oldest", () => {
	const rows = [
		row("mid", "2026-11-10T12:00:00Z"),
		row("bad", "not a date"),
		row("old", "2026-11-09T23:59:59Z"),
		row("new", "2026-11-11T00:00:00Z"),
	];

	it("sorts newest first, a date that does not parse last", () => {
		expect(sorted("newest", rows)).toEqual(["new", "mid", "old", "bad"]);
	});

	it("sorts oldest first, a date that does not parse still last", () => {
		expect(sorted("oldest", rows)).toEqual(["old", "mid", "new", "bad"]);
	});

	it("compares the instant, not the text of the date", () => {
		// 23:00 at -05:00 on the 9th is 04:00 on the 10th in UTC.
		const offset = [
			row("utc", "2026-11-10T03:00:00Z"),
			row("bogota", "2026-11-09T23:00:00-05:00"),
		];
		expect(sorted("newest", offset)).toEqual(["bogota", "utc"]);
		expect(sorted("oldest", offset)).toEqual(["utc", "bogota"]);
	});

	it("answers 0 for the same instant written two ways, and for two dates that do not parse", () => {
		for (const order of ["newest", "oldest"] as const) {
			const compare = compareBy(order);
			expect(
				compare(
					row("a", "2026-11-10T00:00:00Z"),
					row("b", "2026-11-10T01:00:00+01:00"),
				),
			).toBe(0);
			expect(compare(row("a", "x"), row("b", ""))).toBe(0);
		}
	});

	it("keeps the server's order between ties when the sort is stable", () => {
		const ties = [
			row("first", "2026-11-10T00:00:00Z"),
			row("second", "2026-11-10T00:00:00Z"),
			row("x", "bad"),
			row("y", "worse"),
		];
		expect(sorted("newest", ties)).toEqual(["first", "second", "x", "y"]);
		expect(sorted("oldest", ties)).toEqual(["first", "second", "x", "y"]);
	});
});

describe("compareBy: largest", () => {
	it("sorts the largest first", () => {
		const rows = [
			row("small", "2026-11-10T00:00:00Z", 10),
			row("large", "2026-11-01T00:00:00Z", 5000),
			row("medium", "2026-11-05T00:00:00Z", 300),
		];
		expect(sorted("largest", rows)).toEqual(["large", "medium", "small"]);
	});

	it("breaks a tie on size by newest first", () => {
		const rows = [
			row("older", "2026-11-09T00:00:00Z", 100),
			row("bad", "not a date", 100),
			row("newer", "2026-11-10T00:00:00Z", 100),
			row("big", "2020-01-01T00:00:00Z", 101),
		];
		expect(sorted("largest", rows)).toEqual([
			"big",
			"newer",
			"older",
			"bad",
		]);
	});

	it("counts a missing size as 0, so it ties with 0 and falls to newest", () => {
		const rows = [
			row("zero-old", "2026-11-01T00:00:00Z", 0),
			row("none-new", "2026-11-10T00:00:00Z"),
			row("one", "2000-01-01T00:00:00Z", 1),
		];
		expect(sorted("largest", rows)).toEqual([
			"one",
			"none-new",
			"zero-old",
		]);
		const compare = compareBy("largest");
		expect(
			compare(
				row("a", "2026-11-10T00:00:00Z"),
				row("b", "2026-11-10T00:00:00Z", 0),
			),
		).toBe(0);
	});

	it("counts a size that is not a number as 0", () => {
		const rows = [
			row("nan", "2026-11-10T00:00:00Z", Number.NaN),
			row("one", "2026-11-01T00:00:00Z", 1),
			row("zero", "2026-11-05T00:00:00Z", 0),
		];
		expect(sorted("largest", rows)).toEqual(["one", "nan", "zero"]);
	});
});

const DATES = [
	"2026-11-10T00:00:00Z",
	"2026-11-10T01:00:00+01:00",
	"2026-11-10T00:00:00.001Z",
	"2026-11-09T23:59:59Z",
	"1999-01-01T00:00:00Z",
	"not a date",
	"",
];

function randomRow(rng: Rng, index: number): Row {
	return row(
		String(index),
		rng.pick(DATES),
		rng.chance(0.2) ? undefined : rng.pick([0, 1, 1, 500, 500, 70_000]),
	);
}

describe("compareBy as an order", () => {
	it("is antisymmetric, reflexive, transitive, and never NaN", async () => {
		const seen = { zero: 0, nonzero: 0 };
		await runCases("comparator laws", 3000, (rng) => {
			const order = rng.pick(LIST_ORDERS);
			const compare = compareBy(order);
			const [a, b, c] = [0, 1, 2].map((i) => randomRow(rng, i)) as [
				Row,
				Row,
				Row,
			];
			const ab = compare(a, b);
			const label = JSON.stringify([order, a, b, c]);
			expect([label, Number.isNaN(ab)]).toEqual([label, false]);
			expect([label, Math.sign(ab)]).toEqual([
				label,
				-Math.sign(compare(b, a)) || 0,
			]);
			expect([label, compare(a, a)]).toEqual([label, 0]);
			if (ab <= 0 && compare(b, c) <= 0) {
				expect([label, compare(a, c) <= 0]).toEqual([label, true]);
			}
			seen[ab === 0 ? "zero" : "nonzero"]++;
		});
		expect(seen.zero).toBeGreaterThan(100);
		expect(seen.nonzero).toBeGreaterThan(1000);
	});

	it("answers 0 only for two messages that tie on everything it reads", async () => {
		await runCases("ties are real", 3000, (rng) => {
			const order = rng.pick(LIST_ORDERS);
			const [a, b] = [randomRow(rng, 0), randomRow(rng, 1)];
			const time = (r: Row) => {
				const t = new Date(r.receivedAt).getTime();
				return Number.isNaN(t) ? "bad" : t;
			};
			const size = (r: Row) => r.size ?? 0;
			const tie =
				time(a) === time(b) &&
				(order !== "largest" || size(a) === size(b));
			const label = JSON.stringify([order, a, b]);
			expect([label, compareBy(order)(a, b) === 0]).toEqual([label, tie]);
		});
	});
});
