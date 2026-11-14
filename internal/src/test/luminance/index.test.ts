import { describe, expect, it } from "bun:test";

import { contrastRatio, luminance, parseColor } from ".";

describe("the luminance helper of the theme tests", () => {
	it("reads the two spellings of the theme file", () => {
		expect(parseColor("#ffffff")).toEqual([255, 255, 255]);
		expect(parseColor("#171717")).toEqual([23, 23, 23]);
		// The canvas and the rail of the light theme, as a browser paints them.
		expect(parseColor("oklch(0.958 0.005 286.3)")).toEqual([241, 241, 244]);
		expect(parseColor("oklch(0.925 0.006 286.3)")).toEqual([230, 230, 234]);
	});

	it("refuses a value it cannot read", () => {
		expect(() => parseColor("var(--surface)")).toThrow();
		expect(() => parseColor("rgb(0 0 0 / 0.5)")).toThrow();
		expect(() => parseColor("")).toThrow();
	});

	it("weighs black, white and the two against each other as WCAG does", () => {
		expect(luminance([0, 0, 0])).toBe(0);
		expect(luminance([255, 255, 255])).toBeCloseTo(1, 10);
		expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 10);
		expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(21, 10);
		expect(contrastRatio("#777777", "#777777")).toBe(1);
		// A pair with a published ratio: #767676 on white is 4.54:1.
		expect(contrastRatio("#767676", "#ffffff")).toBeCloseTo(4.54, 2);
	});
});
