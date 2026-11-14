import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";

import { BarList } from ".";

afterEach(cleanup);

const ROWS = [
	{ key: "a", label: "example.net", value: 6, valueText: "6", detail: "60%" },
	{ key: "b", label: "example.org", value: 3, valueText: "3", detail: "30%" },
	{ key: "c", label: "mail.test", value: 0, valueText: "0", detail: "0%" },
	{
		key: "rest",
		label: "Other domains",
		value: 1,
		valueText: "1",
		detail: "10%",
		quiet: true,
	},
];

const bar = (container: HTMLElement, key: string) =>
	container.querySelector(`[data-row="${key}"] svg`);

describe("BarList", () => {
	it("writes the name and the figures of every row", () => {
		render(<BarList rows={ROWS} />);

		for (const row of ROWS) {
			expect(screen.getByText(row.label)).toBeVisible();
			expect(screen.getByText(row.detail)).toBeVisible();
		}
		expect(screen.getByText("6")).toBeVisible();
	});

	it("draws the longest bar across the row and the others in proportion", () => {
		const { container } = render(<BarList rows={ROWS} />);

		expect(bar(container, "a")?.getAttribute("width")).toBe("100%");
		expect(bar(container, "b")?.getAttribute("width")).toBe("50%");
		expect(bar(container, "rest")?.getAttribute("width")).toBe("16.667%");
	});

	it("keeps the row of a value of nothing and draws no bar in it", () => {
		const { container } = render(<BarList rows={ROWS} />);

		expect(container.querySelector('[data-row="c"]')).not.toBeNull();
		expect(bar(container, "c")).toBeNull();
	});

	it("draws every bar in the first series colour, and a quiet row in grey", () => {
		const { container } = render(<BarList rows={ROWS} />);

		expect(bar(container, "a")).toHaveClass("bg-chart-1");
		expect(bar(container, "b")).toHaveClass("bg-chart-1");
		expect(bar(container, "rest")).toHaveClass("bg-muted-foreground");
		expect(bar(container, "rest")).not.toHaveClass("bg-chart-1");
	});

	it("never draws a bar with a value under 1 % of the longest", () => {
		const { container } = render(
			<BarList
				rows={[
					{
						key: "big",
						label: "big",
						value: 5000,
						valueText: "5000",
					},
					{ key: "one", label: "one", value: 1, valueText: "1" },
				]}
			/>,
		);

		expect(bar(container, "one")?.getAttribute("width")).toBe("1%");
	});

	it("cuts a long name with an ellipsis and keeps the figure whole", () => {
		const long = `${"sub.".repeat(40)}example.org`;
		render(
			<BarList
				rows={[{ key: "long", label: long, value: 2, valueText: "2" }]}
			/>,
		);

		expect(screen.getByText(long)).toHaveClass("truncate", "min-w-0");
		expect(screen.getByText("2")).toHaveClass("shrink-0");
	});

	it("draws no bar when every value is nothing, and carries no style attribute", () => {
		const { container } = render(
			<BarList
				rows={[
					{ key: "none", label: "none", value: 0, valueText: "0" },
				]}
			/>,
		);

		expect(container.querySelector("svg")).toBeNull();
		expect(container.querySelector("[style]")).toBeNull();
	});
});
