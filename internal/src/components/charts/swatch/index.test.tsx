import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render } from "@testing-library/react";

import { Swatch } from ".";

afterEach(cleanup);

describe("Swatch", () => {
	it("is a square of the series colour on a tile of the card's surface", () => {
		const { container } = render(<Swatch series={2} />);
		const tile = container.querySelector('[data-slot="chart-swatch"]');

		expect(tile).toHaveClass("bg-card");
		expect(tile?.firstElementChild).toHaveClass(
			"bg-chart-3",
			"forced-color-adjust-none",
		);
	});

	it("is hidden from a screen reader: the label beside it says the series", () => {
		const { container } = render(<Swatch series={0} />);

		expect(
			container.querySelector('[data-slot="chart-swatch"]'),
		).toHaveAttribute("aria-hidden", "true");
		expect(container.querySelector("[style]")).toBeNull();
	});
});
