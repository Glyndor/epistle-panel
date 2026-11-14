import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render } from "@testing-library/react";

import { ImportantMark } from ".";

afterEach(cleanup);

describe("ImportantMark", () => {
	it("is a decorative 24 px SVG that follows the text colour", () => {
		const { container } = render(<ImportantMark />);
		const svg = container.querySelector("svg");

		expect(svg).toHaveAttribute("aria-hidden", "true");
		expect(svg).toHaveAttribute("viewBox", "0 0 24 24");
		expect(svg).toHaveAttribute("stroke", "currentColor");
		expect(svg).toHaveAttribute("stroke-width", "2");
		expect(svg).toHaveAttribute("fill", "none");
	});

	it("is one closed shape, so a fill class fills the whole mark", () => {
		const { container } = render(<ImportantMark />);
		const paths = container.querySelectorAll("path");

		expect(paths).toHaveLength(1);
		expect(paths[0]?.getAttribute("d")).toMatch(/z$/);
	});

	it("carries no script, style or external reference", () => {
		const { container } = render(<ImportantMark />);

		expect(container.querySelector("script,style,image,use")).toBeNull();
		expect(container.innerHTML).not.toContain(
			"http://www.w3.org/1999/xlink",
		);
		expect(container.querySelector("svg")).not.toHaveAttribute("style");
	});

	it("passes caller props such as a size and a fill class", () => {
		const { container } = render(
			<ImportantMark className="size-4 fill-current" />,
		);

		expect(container.querySelector("svg")).toHaveClass(
			"size-4",
			"fill-current",
		);
	});
});
