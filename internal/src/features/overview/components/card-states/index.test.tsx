import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";

import { CardEmpty, CardUnavailable } from ".";

afterEach(cleanup);

describe("CardUnavailable", () => {
	it("says the card was not loaded and where the way out is, without a warning of its own", () => {
		const { container } = render(
			<CardUnavailable
				title="Not loaded"
				description="Retry from the top of the page."
			/>,
		);

		expect(screen.getByText("Not loaded")).toBeVisible();
		expect(
			screen.getByText("Retry from the top of the page."),
		).toBeVisible();
		// The page gives the one warning: a card that repeated it would make
		// five alerts of one fault.
		expect(screen.queryByRole("alert")).toBeNull();
		expect(container.querySelector(".bg-warning")).toBeNull();
		expect(
			container.querySelector('[data-state="unavailable"]'),
		).not.toBeNull();
	});
});

describe("CardEmpty", () => {
	it("says what is missing and what to do about it", () => {
		const { container } = render(
			<CardEmpty
				title="The queue is empty"
				description="Nothing waits."
			/>,
		);

		expect(screen.getByText("The queue is empty")).toBeVisible();
		expect(screen.getByText("Nothing waits.")).toBeVisible();
		expect(container.querySelector('[data-slot="empty"]')).not.toBeNull();
	});
});

describe("a card state in the place of its chart", () => {
	const place = <div data-testid="place">figure, rows, button</div>;

	it("lays out what holds the place of the chart, unseen and unread, and centres the message over it", () => {
		const { container } = render(
			<CardEmpty
				title="The queue is empty"
				description="Nothing waits."
				place={place}
			/>,
		);
		const state = container.querySelector('[data-slot="chart-state"]');
		const [held, message] = Array.from(state?.children ?? []);

		// One cell of a grid for both: the taller one gives the height.
		expect(state).toHaveClass("grid");
		expect(held).toHaveClass("col-start-1", "row-start-1", "invisible");
		expect(held).toHaveAttribute("aria-hidden", "true");
		expect(held).toContainElement(screen.getByTestId("place"));
		// The blocks of a card are 12 px apart, as in the card.
		expect(held).toHaveClass("flex-col", "gap-3");
		expect(message).toHaveClass(
			"col-start-1",
			"row-start-1",
			"items-center",
			"justify-center",
		);
		expect(message).toContainElement(
			screen.getByText("The queue is empty"),
		);
		expect(message).not.toHaveAttribute("aria-hidden");
	});

	it("does the same for a card that was not loaded", () => {
		const { container } = render(
			<CardUnavailable
				title="Not loaded"
				description="Retry."
				place={place}
			/>,
		);

		expect(
			container.querySelector('[data-slot="chart-state"] > .invisible'),
		).toContainElement(screen.getByTestId("place"));
		expect(screen.getByText("Not loaded")).toBeVisible();
	});

	it("is the message alone when no place is given", () => {
		const { container } = render(
			<CardEmpty
				title="The queue is empty"
				description="Nothing waits."
			/>,
		);

		expect(container.querySelector('[data-slot="chart-state"]')).toBeNull();
		expect(container.querySelector(".invisible")).toBeNull();
	});
});
