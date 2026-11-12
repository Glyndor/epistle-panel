import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render } from "@testing-library/react";

import { EpistleMark } from ".";

afterEach(cleanup);

describe("EpistleMark", () => {
	it("is a decorative 24 px SVG that follows the text colour", () => {
		const { container } = render(<EpistleMark />);
		const svg = container.querySelector("svg");

		expect(svg).toHaveAttribute("aria-hidden", "true");
		expect(svg).toHaveAttribute("viewBox", "0 0 24 24");
		expect(svg).toHaveAttribute("stroke", "currentColor");
		expect(svg).toHaveAttribute("fill", "none");
	});

	it("carries no script, style or external reference", () => {
		const { container } = render(<EpistleMark />);

		expect(container.querySelector("script,style,image,use")).toBeNull();
		expect(container.innerHTML).not.toContain(
			"http://www.w3.org/1999/xlink",
		);
		expect(container.querySelector("svg")).not.toHaveAttribute("style");
	});

	it("passes caller props such as a size class", () => {
		const { container } = render(<EpistleMark className="size-4" />);

		expect(container.querySelector("svg")).toHaveClass("size-4");
	});
});
