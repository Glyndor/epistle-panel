import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render } from "@testing-library/react";

import { SegmentedBar } from ".";

afterEach(cleanup);

const widths = (container: HTMLElement) =>
	Array.from(container.querySelectorAll("svg")).map((mark) => [
		mark.getAttribute("data-part"),
		mark.getAttribute("width"),
	]);

describe("SegmentedBar", () => {
	it("draws each part as wide as its share, in the order given", () => {
		const { container } = render(
			<SegmentedBar
				parts={[
					{ key: "delivered", value: 50, series: 0 },
					{ key: "deferred", value: 30, series: 1 },
					{ key: "failed", value: 20, series: 2 },
				]}
			/>,
		);

		expect(widths(container)).toEqual([
			["delivered", "50%"],
			["deferred", "30%"],
			["failed", "20%"],
		]);
	});

	it("paints each part in the colour of its series", () => {
		const { container } = render(
			<SegmentedBar
				parts={[
					{ key: "a", value: 1, series: 0 },
					{ key: "b", value: 1, series: 4 },
				]}
			/>,
		);

		expect(container.querySelector('[data-part="a"]')).toHaveClass(
			"bg-chart-1",
		);
		expect(container.querySelector('[data-part="b"]')).toHaveClass(
			"bg-chart-5",
		);
	});

	it("draws nothing for a part with nothing", () => {
		const { container } = render(
			<SegmentedBar
				parts={[
					{ key: "delivered", value: 3, series: 0 },
					{ key: "deferred", value: 0, series: 1 },
					{ key: "failed", value: 1, series: 2 },
				]}
			/>,
		);

		expect(widths(container)).toEqual([
			["delivered", "75%"],
			["failed", "25%"],
		]);
	});

	it("keeps one record among a thousand visible, 2 % of the bar wide", () => {
		const { container } = render(
			<SegmentedBar
				parts={[
					{ key: "delivered", value: 999, series: 0 },
					{ key: "failed", value: 1, series: 2 },
				]}
			/>,
		);

		expect(widths(container)).toEqual([
			["delivered", "98%"],
			["failed", "2%"],
		]);
	});

	it("is 12 pixels high and separates the parts with a gap, not a line", () => {
		const { container } = render(
			<SegmentedBar parts={[{ key: "a", value: 1, series: 0 }]} />,
		);
		const bar = container.querySelector('[data-slot="segmented-bar"]');

		expect(container.querySelector("svg")?.getAttribute("height")).toBe(
			"12",
		);
		expect(bar).toHaveClass("gap-0.5");
		expect(bar?.innerHTML).not.toMatch(/border|stroke/);
	});

	it("has no part to draw when every value is nothing, and no style attribute", () => {
		const { container } = render(
			<SegmentedBar
				parts={[
					{ key: "a", value: 0, series: 0 },
					{ key: "b", value: 0, series: 1 },
				]}
			/>,
		);

		expect(container.querySelectorAll("svg")).toHaveLength(0);
		expect(container.querySelector("[style]")).toBeNull();
	});
});
