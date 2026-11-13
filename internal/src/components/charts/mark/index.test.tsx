import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render } from "@testing-library/react";

import { Mark } from ".";

afterEach(cleanup);

describe("Mark", () => {
	it("is an svg whose size is its width and height attributes", () => {
		const { container } = render(
			<Mark width="37.5%" height={12} className="bg-chart-2" />,
		);
		const mark = container.querySelector("svg");

		expect(mark?.getAttribute("width")).toBe("37.5%");
		expect(mark?.getAttribute("height")).toBe("12");
		expect(mark).toHaveClass("bg-chart-2");
	});

	it("takes a width in pixels too", () => {
		const { container } = render(<Mark width={24} height={80.25} />);
		const mark = container.querySelector("svg");

		expect(mark?.getAttribute("width")).toBe("24");
		expect(mark?.getAttribute("height")).toBe("80.25");
	});

	it("has no child: React could cut the page inside it and send a style attribute", () => {
		const { container } = render(<Mark width="10%" height={8} />);

		expect(container.querySelector("svg")?.childNodes).toHaveLength(0);
	});

	it("carries no style attribute and is hidden from a screen reader", () => {
		const { container } = render(<Mark width="10%" height={8} />);
		const mark = container.querySelector("svg");

		expect(container.querySelector("[style]")).toBeNull();
		expect(mark).toHaveAttribute("aria-hidden", "true");
		expect(mark).toHaveAttribute("focusable", "false");
	});

	it("keeps its colour when the system forces colours, or the chart would be blank", () => {
		const { container } = render(
			<Mark width="10%" height={8} className="bg-chart-1" />,
		);

		expect(container.querySelector("svg")).toHaveClass(
			"forced-color-adjust-none",
			"bg-chart-1",
		);
	});

	it("passes a data attribute on, so a check can find the mark", () => {
		const { container } = render(
			<Mark width="10%" height={8} data-part="failed" />,
		);

		expect(
			container.querySelector('svg[data-part="failed"]'),
		).not.toBeNull();
	});
});
