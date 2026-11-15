import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";

import { SuppressionHeading } from ".";

afterEach(cleanup);

describe("SuppressionHeading", () => {
	it("is the page's h1 with its own words, and one line saying what the page is for", () => {
		render(<SuppressionHeading />);

		const heading = screen.getByRole("heading", { level: 1 });
		expect(heading).toHaveTextContent("heading");
		expect(heading.nextElementSibling).toHaveTextContent("description");
	});

	it("wears the tile of the page's own drawing, hidden from assistive technology", () => {
		const { container } = render(<SuppressionHeading />);
		const tile = container.querySelector('[data-slot="icon-tile"]');

		expect(tile).toHaveAttribute("aria-hidden", "true");
		expect(tile?.querySelector('[data-glyph="ban"]')).not.toBeNull();
	});

	it("has no action: the page's controls are below", () => {
		const { container } = render(<SuppressionHeading />);

		expect(
			container.querySelector('[data-slot="page-header-actions"]'),
		).toBeNull();
	});
});
