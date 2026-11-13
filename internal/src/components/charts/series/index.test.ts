import { describe, expect, it } from "bun:test";

import { percent, SERIES } from ".";

describe("percent", () => {
	it("writes a number as an SVG percentage", () => {
		expect(percent(50)).toBe("50%");
		expect(percent(12.5)).toBe("12.5%");
		expect(percent(0)).toBe("0%");
	});

	it("keeps three decimals at most and no trailing zero", () => {
		expect(percent(100 / 3)).toBe("33.333%");
		expect(percent(200 / 3)).toBe("66.667%");
		expect(percent(2.5)).toBe("2.5%");
	});
});

describe("SERIES", () => {
	it("is the five theme tokens of the palette, in order, and nothing else", () => {
		expect([...SERIES]).toEqual([
			"bg-chart-1",
			"bg-chart-2",
			"bg-chart-3",
			"bg-chart-4",
			"bg-chart-5",
		]);
	});
});
