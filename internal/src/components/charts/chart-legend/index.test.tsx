import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen, within } from "@testing-library/react";

import { ChartLegend } from ".";

afterEach(cleanup);

describe("ChartLegend", () => {
	it("lists every series by name, in the order given, beside its colour", () => {
		render(
			<ChartLegend
				items={[
					{ key: "delivered", label: "Delivered", series: 0 },
					{ key: "failed", label: "Failed", series: 2 },
				]}
			/>,
		);
		const items = screen.getAllByRole("listitem");

		expect(items.map((item) => item.textContent)).toEqual([
			"Delivered",
			"Failed",
		]);
		expect(
			items[1]?.querySelector('[data-slot="chart-swatch"] span'),
		).toHaveClass("bg-chart-3");
	});

	it("tints an entry under the pointer and presses it deeper, with a margin that cancels its padding", () => {
		render(
			<ChartLegend
				items={[{ key: "delivered", label: "Delivered", series: 0 }]}
			/>,
		);

		expect(screen.getByRole("listitem")).toHaveClass(
			"hover:bg-accent",
			"active:bg-accent-press",
			"hover:text-accent-foreground",
			"-mx-1.5",
			"px-1.5",
			"-my-0.5",
			"py-0.5",
		);
	});

	it("keys an entry with no series with the tone of the band, not a series colour", () => {
		render(
			<ChartLegend items={[{ key: "missing", label: "Not returned" }]} />,
		);
		const item = screen.getByRole("listitem");

		expect(within(item).getByText("Not returned")).toBeVisible();
		expect(item.querySelector('[data-slot="chart-swatch"]')).toBeNull();
		expect(item.firstElementChild).toHaveClass("bg-chart-missing");
		expect(item.firstElementChild).not.toHaveClass("bg-muted");
	});

	it("carries no style attribute", () => {
		const { container } = render(
			<ChartLegend items={[{ key: "a", label: "A", series: 0 }]} />,
		);

		expect(container.querySelector("[style]")).toBeNull();
	});
});
