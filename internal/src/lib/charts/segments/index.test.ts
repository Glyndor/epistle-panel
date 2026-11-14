import { describe, expect, it } from "bun:test";

import { layoutSegments } from ".";

const widths = (values: readonly number[], min?: number) =>
	layoutSegments(values, min).map((segment) => segment.width);

describe("layoutSegments", () => {
	it("gives each part its share of the bar, one after the other", () => {
		expect(layoutSegments([50, 30, 20])).toEqual([
			{ start: 0, width: 50 },
			{ start: 50, width: 30 },
			{ start: 80, width: 20 },
		]);
	});

	it("draws nothing for a part with nothing and does not move the next", () => {
		expect(layoutSegments([60, 0, 40])).toEqual([
			{ start: 0, width: 60 },
			{ start: 60, width: 0 },
			{ start: 60, width: 40 },
		]);
	});

	it("raises a sliver to the minimum and takes it from the wide parts", () => {
		// 1 of 1000 would be 0.1 % of the bar, under a pixel on a phone.
		const [large, small] = widths([999, 1], 2);

		expect(small).toBe(2);
		expect(large).toBe(98);
	});

	it("still fills the whole bar after raising slivers", () => {
		const laid = layoutSegments([900, 1, 1, 98], 2);
		const last = laid[laid.length - 1];

		expect(laid.map((segment) => segment.width)[1]).toBe(2);
		expect((last?.start ?? 0) + (last?.width ?? 0)).toBeCloseTo(100, 10);
	});

	it("leaves a part that is already wide enough alone when none is short", () => {
		expect(widths([70, 30], 2)).toEqual([70, 30]);
	});

	it("cuts a minimum the parts cannot all have", () => {
		// Four parts cannot each be 40 % wide: they share the bar.
		expect(widths([1, 1, 1, 1], 40)).toEqual([25, 25, 25, 25]);
	});

	it("has no bar when every part is nothing", () => {
		expect(layoutSegments([0, 0])).toEqual([
			{ start: 0, width: 0 },
			{ start: 0, width: 0 },
		]);
		expect(layoutSegments([])).toEqual([]);
	});

	it("counts a negative or broken value as nothing", () => {
		expect(widths([-3, Number.NaN, 4])).toEqual([0, 0, 100]);
	});
});
