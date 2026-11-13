import { describe, expect, it } from "bun:test";

import { axisLabels } from ".";

describe("axisLabels", () => {
	it("labels the columns asked for, at the centre of their slot", () => {
		expect(axisLabels(4, (index) => index % 2 === 1)).toEqual([
			{ index: 1, x: 37.5, anchor: "middle" },
			{ index: 3, x: 87.5, anchor: "middle" },
		]);
	});

	it("runs a label inward when its column is at an edge", () => {
		const labels = axisLabels(25, (index) => index === 0 || index === 24);

		expect(labels).toEqual([
			{ index: 0, x: 2, anchor: "start" },
			{ index: 24, x: 98, anchor: "end" },
		]);
	});

	it("centres a label that has room on both sides", () => {
		expect(axisLabels(25, (index) => index === 12)[0]?.anchor).toBe(
			"middle",
		);
	});

	it("has no label when none is wanted or there is no column", () => {
		expect(axisLabels(8, () => false)).toEqual([]);
		expect(axisLabels(0, () => true)).toEqual([]);
	});
});
