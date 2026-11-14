import { describe, expect, it } from "bun:test";

import { niceCountScale } from ".";

describe("niceCountScale", () => {
	it("ends on the first round number at or above the data", () => {
		expect(niceCountScale(23)).toEqual({
			max: 30,
			step: 10,
			ticks: [0, 10, 20, 30],
		});
	});

	it("keeps the data's own top when it is already round", () => {
		expect(niceCountScale(100)).toEqual({
			max: 100,
			step: 50,
			ticks: [0, 50, 100],
		});
	});

	it("never steps by less than one: a count has no half", () => {
		expect(niceCountScale(1)).toEqual({ max: 1, step: 1, ticks: [0, 1] });
		expect(niceCountScale(3)).toEqual({
			max: 3,
			step: 1,
			ticks: [0, 1, 2, 3],
		});
	});

	it("steps by 1, 2 or 5 times a power of ten", () => {
		expect(niceCountScale(7).step).toBe(2);
		expect(niceCountScale(18).step).toBe(5);
		expect(niceCountScale(64).step).toBe(20);
		expect(niceCountScale(350).step).toBe(100);
	});

	it("has at most the ticks asked for above zero", () => {
		for (const top of [1, 2, 5, 9, 14, 37, 99, 100, 101, 480, 1000]) {
			const scale = niceCountScale(top, 4);
			expect(scale.ticks.length - 1).toBeLessThanOrEqual(4);
			expect(scale.max).toBeGreaterThanOrEqual(top);
			expect(scale.ticks[0]).toBe(0);
			expect(scale.ticks[scale.ticks.length - 1]).toBe(scale.max);
		}
	});

	it("rounds a fraction up to the next whole count", () => {
		expect(niceCountScale(2.2).max).toBe(3);
	});

	it("still has a top with nothing to show", () => {
		for (const nothing of [0, -4, Number.NaN, Infinity]) {
			expect(niceCountScale(nothing)).toEqual({
				max: 1,
				step: 1,
				ticks: [0, 1],
			});
		}
	});
});
