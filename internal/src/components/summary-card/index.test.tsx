import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";

import { SummaryCard, SummaryCardSkeleton } from ".";

afterEach(cleanup);

const inList = (node: React.ReactNode) => <dl>{node}</dl>;

describe("SummaryCard", () => {
	it("is one group of a description list: a label with its number, and a tile that is not read", () => {
		const { container } = render(
			inList(<SummaryCard icon="globe" label="Domains" value="12" />),
		);
		const card = container.querySelector('[data-slot="summary-card"]');

		expect(card?.parentElement?.tagName).toBe("DL");
		expect(card?.querySelector("dt")).toHaveTextContent("Domains");
		expect(card?.querySelector("dd")).toHaveTextContent("12");
		expect(card?.textContent).toBe("Domains12");
		const tile = card?.querySelector('[data-slot="icon-tile"]');
		expect(tile).toHaveAttribute("aria-hidden", "true");
		expect(tile?.querySelector('[data-glyph="globe"]')).not.toBeNull();
	});

	it("puts the tile across the two lines so the card is no higher than the text", () => {
		const { container } = render(
			inList(<SummaryCard icon="users" label="Accounts" value="3" />),
		);

		expect(container.querySelector('[data-slot="icon-tile"]')).toHaveClass(
			"row-span-2",
		);
		expect(
			container.querySelector('[data-slot="summary-card"]'),
		).toHaveClass("grid", "p-3");
	});

	it("draws a value that could not be read in the muted tone", () => {
		render(
			inList(<SummaryCard icon="inbox" label="Queue" value="-" quiet />),
		);

		expect(screen.getByText("-")).toHaveClass("text-muted-foreground");
	});

	it("draws a value that was read in the foreground tone", () => {
		render(inList(<SummaryCard icon="inbox" label="Queue" value="4" />));

		expect(screen.getByText("4")).not.toHaveClass("text-muted-foreground");
		expect(screen.getByText("4")).toHaveClass("tabular-nums");
	});
});

describe("SummaryCardSkeleton", () => {
	it("holds the place of the tile and of both lines, hidden from assistive technology", () => {
		const { container } = render(<SummaryCardSkeleton />);

		expect(container.firstElementChild).toHaveAttribute(
			"aria-hidden",
			"true",
		);
		expect(
			container.querySelectorAll('[data-slot="skeleton"]'),
		).toHaveLength(3);
		expect(container.querySelector(".size-9.row-span-2")).not.toBeNull();
		expect(container.firstElementChild).toHaveClass("grid", "p-3");
	});
});
