import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen, within } from "@testing-library/react";

import { CARD_SPAN, DeliveriesSection, NowSection } from ".";

afterEach(cleanup);

describe("DeliveriesSection", () => {
	it("is a region named by its heading, with the period links and the cards", () => {
		render(
			<DeliveriesSection heading="Deliveries" nav={<nav>periods</nav>}>
				<p>cards</p>
			</DeliveriesSection>,
		);
		const region = screen.getByRole("region", { name: "Deliveries" });

		expect(
			within(region).getByRole("heading", { level: 2 }),
		).toHaveTextContent("Deliveries");
		expect(within(region).getByRole("navigation")).toHaveTextContent(
			"periods",
		);
		expect(within(region).getByText("cards")).toBeVisible();
	});

	it("lays the cards out by the width of its own container, two fifths and three", () => {
		const { container } = render(
			<DeliveriesSection heading="Deliveries" nav={null}>
				<p>cards</p>
			</DeliveriesSection>,
		);
		const grid = screen.getByText("cards").parentElement;

		expect(grid).toHaveClass("grid", "gap-3", "@3xl:grid-cols-5");
		expect(grid?.parentElement).toHaveClass("@container");
		expect(CARD_SPAN).toEqual({
			outcomes: "@3xl:col-span-2",
			timeline: "@3xl:col-span-3",
		});
		expect(container.querySelector("[style]")).toBeNull();
	});

	it("leaves each card as high as its own content, so an open table does not stretch its neighbour", () => {
		render(
			<DeliveriesSection heading="Deliveries" nav={null}>
				<p>cards</p>
			</DeliveriesSection>,
		);

		expect(screen.getByText("cards").parentElement).toHaveClass(
			"items-start",
		);
	});
});

describe("NowSection", () => {
	it("is a region named by its heading, with two columns from 48rem of its container", () => {
		render(
			<NowSection heading="Queue and suppression">
				<p>cards</p>
			</NowSection>,
		);
		const region = screen.getByRole("region", {
			name: "Queue and suppression",
		});

		expect(
			within(region).getByRole("heading", { level: 2 }),
		).toHaveTextContent("Queue and suppression");
		expect(screen.getByText("cards").parentElement).toHaveClass(
			"grid",
			"items-start",
			"gap-3",
			"@3xl:grid-cols-2",
		);
	});
});
