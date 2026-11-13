import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";

import type { SeriesIndex } from "../series";
import { StackedColumns } from ".";

afterEach(cleanup);

const SERIES: SeriesIndex[] = [0, 1, 2];
const tick = (value: number) => `n${value}`;

const column = (container: HTMLElement, key: string) =>
	container.querySelector(`[data-column="${key}"]`);
const stack = (container: HTMLElement, key: string) =>
	column(container, key)?.querySelector('[data-slot="chart-stack"]') ?? null;
const heights = (container: HTMLElement, key: string) =>
	Array.from(column(container, key)?.querySelectorAll("svg") ?? []).map(
		(mark) => [
			mark.getAttribute("data-series"),
			mark.getAttribute("height"),
		],
	);

const three = [
	{ key: "h1", values: [10, 0, 0], hint: "01:00: 10", label: "01:00" },
	{ key: "h2", values: [10, 5, 5], hint: "02:00: 20" },
	{ key: "h3", values: [0, 0, 0], hint: "03:00: not returned", shaded: true },
];

describe("StackedColumns", () => {
	it("draws a slot per column, also for one with nothing", () => {
		const { container } = render(
			<StackedColumns
				columns={three}
				series={SERIES}
				formatTick={tick}
			/>,
		);

		expect(container.querySelectorAll("[data-column]")).toHaveLength(3);
		expect(column(container, "h3")?.querySelectorAll("svg")).toHaveLength(
			0,
		);
	});

	it("stacks each column from the baseline on a scale that ends on a round number", () => {
		const { container } = render(
			<StackedColumns
				columns={three}
				series={SERIES}
				formatTick={tick}
			/>,
		);

		// The tallest column is 20 and the axis ends there: 160 px for 20,
		// its two gaps of 2 px included, so the parts share 156 px.
		expect(heights(container, "h1")).toEqual([["0", "80"]]);
		expect(heights(container, "h2")).toEqual([
			["0", "78"],
			["1", "39"],
			["2", "39"],
		]);
		expect(stack(container, "h2")).toHaveClass("flex-col-reverse");
		expect(stack(container, "h2")).toHaveClass("gap-0.5");
	});

	it("draws a column too low for its gaps without them, and no higher for it", () => {
		const { container } = render(
			<StackedColumns
				columns={[
					{ key: "peak", values: [60, 0, 0], hint: "" },
					{ key: "low", values: [1, 1, 1], hint: "" },
				]}
				series={SERIES}
				formatTick={tick}
			/>,
		);

		// 3 of 60 on 160 px is 8 px: three parts of 2.67 px, with no room for
		// two gaps as well.
		expect(heights(container, "low")).toEqual([
			["0", "2.67"],
			["1", "2.67"],
			["2", "2.67"],
		]);
		expect(stack(container, "low")).not.toHaveClass("gap-0.5");
		expect(heights(container, "peak")).toEqual([["0", "160"]]);
	});

	it("paints each part in the colour of its series", () => {
		const { container } = render(
			<StackedColumns
				columns={three}
				series={[4, 3, 2]}
				formatTick={tick}
			/>,
		);
		const marks = column(container, "h2")?.querySelectorAll("svg");

		expect(marks?.[0]).toHaveClass("bg-chart-5");
		expect(marks?.[1]).toHaveClass("bg-chart-4");
		expect(marks?.[2]).toHaveClass("bg-chart-3");
	});

	it("writes the numbers of the count axis from zero up, through the formatter", () => {
		const { container } = render(
			<StackedColumns
				columns={three}
				series={SERIES}
				formatTick={tick}
			/>,
		);
		const axis = container.querySelector('[data-slot="chart-axis"]');

		expect(
			Array.from(axis?.children ?? []).map((item) => item.textContent),
		).toEqual(["n0", "n5", "n10", "n15", "n20"]);
	});

	it("marks the levels of the axis with bands of two tones, the lowest the deeper, and no line", () => {
		const { container } = render(
			<StackedColumns
				columns={three}
				series={SERIES}
				formatTick={tick}
			/>,
		);
		const levels = container.querySelector('[data-slot="chart-levels"]');
		const bands = Array.from(levels?.children ?? []);

		// Five numbers on the axis, four levels between them, from the baseline up.
		expect(bands).toHaveLength(4);
		expect(
			bands.map((band) => band.classList.contains("bg-surface-sunken")),
		).toEqual([true, false, true, false]);
		expect(levels).toHaveClass("flex-col-reverse");
		expect(container.innerHTML).not.toMatch(/h-px|border|divide-/);
	});

	it("labels the columns that have a label, as text of the page", () => {
		const { container } = render(
			<StackedColumns
				columns={three}
				series={SERIES}
				formatTick={tick}
			/>,
		);

		expect(screen.getByText("01:00")).toBeVisible();
		expect(
			container.querySelectorAll('[data-slot="chart-tick"]'),
		).toHaveLength(1);
	});

	it("runs the label of a column at an edge inward", () => {
		const many = Array.from({ length: 25 }, (_, index) => ({
			key: `c${index}`,
			values: [1],
			hint: "",
			...(index === 0 || index === 12 || index === 24
				? { label: `L${index}` }
				: {}),
		}));
		render(
			<StackedColumns columns={many} series={[0]} formatTick={tick} />,
		);

		expect(screen.getByText("L0")).toHaveClass("left-0");
		expect(screen.getByText("L12")).toHaveClass("left-1/2");
		expect(screen.getByText("L24")).toHaveClass("right-0");
	});

	it("fills a column with missing data with the band of its own token, and only that one", () => {
		const { container } = render(
			<StackedColumns
				columns={three}
				series={SERIES}
				formatTick={tick}
			/>,
		);
		const band = column(container, "h3")?.querySelector(
			'[data-slot="chart-missing"]',
		);

		expect(column(container, "h3")).toHaveAttribute("data-shaded", "true");
		expect(band).toHaveClass("flex-1", "bg-chart-missing");
		expect(band).toHaveClass("forced-color-adjust-none");
		expect(column(container, "h1")).not.toHaveAttribute("data-shaded");
		expect(
			container.querySelectorAll('[data-slot="chart-missing"]'),
		).toHaveLength(1);
		// The muted surface is 1.2:1 against the card: no mark is drawn with it.
		expect(container.innerHTML).not.toContain("bg-muted");
	});

	it("draws the band over the parts of a column, never behind them", () => {
		const { container } = render(
			<StackedColumns
				columns={[
					{ key: "whole", values: [10, 0, 0], hint: "" },
					{ key: "part", values: [4, 2, 0], hint: "", shaded: true },
				]}
				series={SERIES}
				formatTick={tick}
			/>,
		);
		const part = column(container, "part");
		const band = part?.querySelector('[data-slot="chart-missing"]');

		// The column is reversed, so the band, last in the markup, is on top.
		expect(part).toHaveClass("flex-col-reverse", "gap-0.5");
		expect(part?.lastElementChild).toBe(band ?? null);
		expect(part?.firstElementChild).toBe(stack(container, "part"));
		expect(band?.querySelector("svg")).toBeNull();
		expect(part).not.toHaveClass("bg-chart-missing");
	});

	it("leaves room over a column that holds part of its data, so its band is always drawn", () => {
		const { container } = render(
			<StackedColumns
				columns={[
					{ key: "part", values: [20, 0, 0], hint: "", shaded: true },
					{ key: "whole", values: [5, 0, 0], hint: "" },
				]}
				series={SERIES}
				formatTick={tick}
			/>,
		);
		const axis = container.querySelector('[data-slot="chart-axis"]');

		// 20 is the most, and it may be more. An axis for 20 would end on 20;
		// this one is drawn for 22 and ends on 30, so the column stops short
		// of the top: 20 of 30 on 160 px.
		expect(axis?.lastElementChild?.textContent).toBe("n30");
		expect(heights(container, "part")).toEqual([["0", "106.67"]]);
	});

	it("tells the pointer what a column holds", () => {
		const { container } = render(
			<StackedColumns
				columns={three}
				series={SERIES}
				formatTick={tick}
			/>,
		);

		expect(column(container, "h2")).toHaveAttribute("title", "02:00: 20");
	});

	it("draws few columns 24 px wide and many as a share of their slot", () => {
		const few = render(
			<StackedColumns
				columns={three}
				series={SERIES}
				formatTick={tick}
			/>,
		);
		expect(
			few.container
				.querySelector("[data-column] svg")
				?.getAttribute("width"),
		).toBe("24");
		few.unmount();

		const many = Array.from({ length: 25 }, (_, index) => ({
			key: `c${index}`,
			values: [1],
			hint: "",
		}));
		const { container } = render(
			<StackedColumns columns={many} series={[0]} formatTick={tick} />,
		);
		expect(
			container.querySelector("[data-column] svg")?.getAttribute("width"),
		).toBe("60%");
	});

	it("still has an axis with nothing to draw, and no style attribute", () => {
		const { container } = render(
			<StackedColumns
				columns={[{ key: "empty", values: [0], hint: "" }]}
				series={[0]}
				formatTick={tick}
			/>,
		);
		const axis = container.querySelector('[data-slot="chart-axis"]');

		expect(axis?.textContent).toBe("n0n1");
		expect(container.querySelector("svg")).toBeNull();
		expect(container.querySelector("[style]")).toBeNull();
	});
});
