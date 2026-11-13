import { describe, expect, it } from "bun:test";

import { sharesPerMille } from ".";

const sum = (values: readonly number[]) =>
	values.reduce((total, value) => total + value, 0);

describe("sharesPerMille", () => {
	it("gives each value its share in tenths of a percent", () => {
		expect(sharesPerMille([50, 30, 20])).toEqual([500, 300, 200]);
	});

	it("adds up to exactly 1000 where plain rounding gives 999", () => {
		// Three thirds round to 333 each, which is 99.9 %.
		const shares = sharesPerMille([1, 1, 1]);

		expect(shares).toEqual([334, 333, 333]);
		expect(sum(shares)).toBe(1000);
	});

	it("adds up to exactly 1000 where plain rounding gives 1001", () => {
		// Three sixths are 166.67 each: rounded on their own they are 167, and
		// with the half that makes 1001.
		const shares = sharesPerMille([1, 1, 1, 3]);

		expect(sum(shares)).toBe(1000);
		expect(shares).toEqual([167, 167, 166, 500]);
	});

	it("hands the tenths left over to the largest lost fractions first", () => {
		// Exact shares 571.43, 285.71, 142.86: floors add up to 998, and the two
		// spare tenths go to .86 and .71, not to .43.
		expect(sharesPerMille([4, 2, 1])).toEqual([571, 286, 143]);
	});

	it("keeps a zero at zero and still adds up", () => {
		const shares = sharesPerMille([0, 7, 0, 3]);

		expect(shares).toEqual([0, 700, 0, 300]);
	});

	it("has no shares when there is nothing to share", () => {
		expect(sharesPerMille([0, 0, 0])).toEqual([0, 0, 0]);
		expect(sharesPerMille([])).toEqual([]);
	});

	it("counts a negative or broken value as nothing", () => {
		expect(sharesPerMille([-5, Number.NaN, 5, Infinity])).toEqual([
			0, 0, 1000, 0,
		]);
	});

	it("adds up for every split of a hundred records into five", () => {
		for (let a = 0; a <= 100; a += 7) {
			for (let b = 0; a + b <= 100; b += 11) {
				const rest = 100 - a - b;
				const shares = sharesPerMille([a, b, rest, 0, 0]);
				expect(sum(shares)).toBe(1000);
				expect(shares.every((share) => share >= 0)).toBe(true);
			}
		}
	});
});
