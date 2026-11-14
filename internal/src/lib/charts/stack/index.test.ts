import { describe, expect, it } from "bun:test";

import { runCases } from "@/test/prng";

import {
	type ColumnStack,
	columnWidth,
	MIN_PART_HEIGHT,
	PART_GAP,
	stackColumn,
} from ".";

/** What a column measures drawn: its parts, plus the gaps between them. */
function drawnHeight(stack: ColumnStack): number {
	const parts = stack.parts.filter((part) => part !== null);
	return (
		parts.reduce((sum, part) => sum + part.height, 0) +
		stack.gap * Math.max(0, parts.length - 1)
	);
}

describe("stackColumn", () => {
	it("draws a column as high as its total on the scale, gaps included", () => {
		// 15 of 20 on a 160 px plot is 120 px: 118 px of parts and one gap.
		const stack = stackColumn([10, 5], 20, 160);

		expect(stack.height).toBe(120);
		expect(stack.gap).toBe(2);
		expect(stack.parts[0]?.height).toBeCloseTo((118 * 2) / 3, 9);
		expect(stack.parts[1]?.height).toBeCloseTo(118 / 3, 9);
		expect(drawnHeight(stack)).toBeCloseTo(120, 9);
	});

	it("stacks from the baseline up, each part two pixels over the one below", () => {
		const { parts } = stackColumn([4, 4, 4], 12, 120);
		const [low, middle, high] = parts;

		// 120 px for three equal parts and two gaps: 116 / 3 each.
		expect((low?.y ?? 0) + (low?.height ?? 0)).toBeCloseTo(120, 9);
		expect((middle?.y ?? 0) + (middle?.height ?? 0)).toBeCloseTo(
			(low?.y ?? 0) - 2,
			9,
		);
		expect((high?.y ?? 0) + (high?.height ?? 0)).toBeCloseTo(
			(middle?.y ?? 0) - 2,
			9,
		);
		expect(high?.y).toBeCloseTo(0, 9);
	});

	it("draws nothing for a value of nothing and does not leave its gap", () => {
		expect(stackColumn([0, 10], 20, 160)).toEqual({
			height: 80,
			gap: 2,
			parts: [null, { y: 80, height: 80 }],
		});
		expect(stackColumn([10, 0, 10], 20, 160)).toEqual({
			height: 160,
			gap: 2,
			parts: [{ y: 81, height: 79 }, null, { y: 0, height: 79 }],
		});
	});

	it("takes the minimum of a small part out of the larger ones, not out of the plot", () => {
		// 200 and 1 of 400: 80.4 px in all, never the 80 + 2 + 3 of adding up.
		const stack = stackColumn([200, 1], 400, 160);

		expect(stack.height).toBeCloseTo(80.4, 9);
		expect(stack.parts[1]?.height).toBeCloseTo(MIN_PART_HEIGHT, 9);
		expect(stack.parts[0]?.height).toBeCloseTo(80.4 - 2 - 3, 9);
		expect(drawnHeight(stack)).toBeCloseTo(80.4, 9);
	});

	it("keeps five records lower than eight, and seventy-nine of eighty inside the plot", () => {
		// The columns of the `skew` sample on its axis of 0 to 60: one record of
		// each outcome, 12 of one, 1 and 1, 8 of one.
		const five = stackColumn([1, 1, 1, 1, 1], 60, 160);
		const eight = stackColumn([8, 0, 0, 0, 0], 60, 160);

		expect(drawnHeight(five)).toBeCloseTo((5 * 160) / 60, 9);
		expect(drawnHeight(eight)).toBeCloseTo((8 * 160) / 60, 9);
		expect(drawnHeight(five)).toBeLessThan(drawnHeight(eight));
		// 13.3 px cannot hold five parts of 3 px and four gaps: the gaps go.
		expect(five.gap).toBe(0);
		expect(five.parts.map((part) => part?.height)).toEqual(
			Array.from({ length: 5 }, () => expect.closeTo(160 / 60, 9)),
		);

		const full = stackColumn([75, 1, 1, 1, 1], 80, 160);
		expect(drawnHeight(full)).toBeCloseTo(158, 9);
		expect(Math.min(...full.parts.map((part) => part?.y ?? 0))).toBeCloseTo(
			2,
			9,
		);
	});

	it("shares a column too low for the minimum evenly, with no gap", () => {
		// 3 of 400 on 160 px is 1.2 px for three parts.
		const stack = stackColumn([1, 1, 1], 400, 160);

		expect(stack.gap).toBe(0);
		expect(stack.height).toBeCloseTo(1.2, 9);
		expect(stack.parts.map((part) => part?.height)).toEqual([
			expect.closeTo(0.4, 9),
			expect.closeTo(0.4, 9),
			expect.closeTo(0.4, 9),
		]);
	});

	it("never draws a column with a value under one pixel, nor over the plot", () => {
		// 1 of 4000 on 160 px would be 0.04 px.
		expect(stackColumn([1], 4000, 160)).toEqual({
			height: 1,
			gap: 0,
			parts: [{ y: 159, height: 1 }],
		});
		// A total over the top of the scale stops at the top.
		expect(stackColumn([30, 30], 40, 160).height).toBe(160);
		expect(stackColumn([30, 30], 40, 160).parts[1]?.y).toBeCloseTo(0, 9);
	});

	it("draws nothing on a scale or a plot with no height", () => {
		const nothing = { height: 0, gap: 0, parts: [null] };

		expect(stackColumn([5], 0, 160)).toEqual(nothing);
		expect(stackColumn([5], 10, 0)).toEqual(nothing);
	});

	it("counts a negative or broken value as nothing", () => {
		expect(stackColumn([-2, Number.NaN], 10, 100)).toEqual({
			height: 0,
			gap: 0,
			parts: [null, null],
		});
		expect(stackColumn([-2, 5], 10, 100).height).toBe(50);
	});
});

describe("stackColumn on generated columns", () => {
	const PLOT = 160;
	const column = (rng: {
		int(min: number, max: number): number;
		chance(p?: number): boolean;
	}) =>
		Array.from({ length: 5 }, () => {
			if (rng.chance(0.35)) {
				return 0;
			}
			return rng.chance(0.3) ? rng.int(1, 3) : rng.int(1, 4000);
		});
	const sum = (values: readonly number[]) =>
		values.reduce((total, value) => total + value, 0);

	it("draws every column as high as its total on the scale, within a pixel", async () => {
		await runCases("column height", 3000, (rng) => {
			const values = column(rng);
			const total = sum(values);
			const max = total + rng.int(0, 4000);
			const stack = stackColumn(values, max, PLOT);
			const expected = max === 0 ? 0 : (total * PLOT) / max;

			expect(Math.abs(drawnHeight(stack) - expected)).toBeLessThanOrEqual(
				1,
			);
			expect(drawnHeight(stack)).toBeCloseTo(stack.height, 6);
			expect(stack.height).toBeLessThanOrEqual(PLOT);
		});
	});

	it("never draws the column of more lower than the column of less", async () => {
		await runCases("column order", 3000, (rng) => {
			const a = column(rng);
			const b = column(rng);
			const max = Math.max(sum(a), sum(b)) + rng.int(0, 500);
			const [more, less] = sum(a) >= sum(b) ? [a, b] : [b, a];

			expect(
				drawnHeight(stackColumn(more, max, PLOT)),
			).toBeGreaterThanOrEqual(
				drawnHeight(stackColumn(less, max, PLOT)) - 1e-9,
			);
		});
	});

	it("keeps every part inside the plot, in order, and seen", async () => {
		await runCases("column parts", 3000, (rng) => {
			const values = column(rng);
			const max = sum(values) + rng.int(0, 4000);
			const stack = stackColumn(values, max, PLOT);
			let floor = PLOT;

			for (const [index, part] of stack.parts.entries()) {
				expect(part === null).toBe((values[index] ?? 0) === 0);
				if (part === null) {
					continue;
				}
				expect(part.height).toBeGreaterThan(0);
				expect(part.y).toBeGreaterThanOrEqual(-1e-9);
				expect(part.y + part.height).toBeLessThanOrEqual(floor + 1e-9);
				floor = part.y;
			}
			if (stack.gap === PART_GAP) {
				for (const part of stack.parts) {
					expect(
						part?.height ?? MIN_PART_HEIGHT,
					).toBeGreaterThanOrEqual(MIN_PART_HEIGHT - 1e-9);
				}
			}
		});
	});
});

describe("columnWidth", () => {
	it("draws few columns 24 pixels wide", () => {
		expect(columnWidth(1)).toBe(24);
		expect(columnWidth(8)).toBe(24);
		expect(columnWidth(10)).toBe(24);
	});

	it("draws many columns as 60 % of their slot", () => {
		expect(columnWidth(11)).toBe("60%");
		expect(columnWidth(25)).toBe("60%");
		expect(columnWidth(31)).toBe("60%");
	});
});
