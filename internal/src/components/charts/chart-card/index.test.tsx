import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";

import { ChartCard, ChartFigure, ChartImage, ChartNote } from ".";

afterEach(cleanup);

function setup() {
	return render(
		<ChartCard
			id="demo"
			title="Deliveries by outcome"
			note="Last 24 hours"
			action={<a href="/log">Delivery log</a>}
		>
			<ChartFigure value="67" label="records" />
			<ChartImage id="demo" description="67 records: 48 delivered.">
				<span data-testid="drawing" />
			</ChartImage>
			<ChartNote>Only 100 records.</ChartNote>
		</ChartCard>,
	);
}

describe("ChartCard", () => {
	it("is a figure named by its visible title", () => {
		setup();

		const figure = screen.getByRole("figure", {
			name: "Deliveries by outcome",
		});
		expect(figure).toBeInTheDocument();
		expect(
			screen.getByRole("heading", {
				level: 3,
				name: "Deliveries by outcome",
			}),
		).toBeVisible();
	});

	it("shows the note under the title and the link at the end of the row", () => {
		setup();

		expect(screen.getByText("Last 24 hours")).toBeVisible();
		expect(
			screen.getByRole("link", { name: "Delivery log" }),
		).toHaveAttribute("href", "/log");
	});

	it("leaves the note out when there is none", () => {
		const { container } = render(
			<ChartCard id="bare" title="Queue">
				<p>body</p>
			</ChartCard>,
		);

		expect(container.querySelector("figcaption p")).toBeNull();
	});

	it("draws no line around itself and carries no style attribute", () => {
		const { container } = setup();
		const card = container.querySelector('[data-slot="chart-card"]');

		expect(card?.className).not.toMatch(/\bborder\b|\bdivide-|\bshadow/);
		expect(container.querySelector("[style]")).toBeNull();
	});
});

describe("ChartImage", () => {
	it("is one image named by the card's title and described by its sentence", () => {
		setup();

		const image = screen.getByRole("img", {
			name: "Deliveries by outcome",
		});
		expect(image).toHaveAccessibleDescription("67 records: 48 delivered.");
	});

	it("keeps the description off the screen: the drawing is what is seen", () => {
		const { container } = setup();
		const description = container.querySelector("#demo-description");

		expect(description).toHaveAttribute("hidden");
		expect(description?.textContent).toBe("67 records: 48 delivered.");
	});

	it("holds the drawing and no link", () => {
		setup();
		const image = screen.getByRole("img");

		expect(image).toContainElement(screen.getByTestId("drawing"));
		expect(image.querySelector("a, button")).toBeNull();
	});
});

describe("ChartFigure and ChartNote", () => {
	it("shows the headline number beside what it counts", () => {
		const { container } = setup();
		const figure = container.querySelector('[data-slot="chart-figure"]');

		expect(figure?.textContent).toBe("67records");
	});

	it("shows a caveat as a tonal callout with no line", () => {
		setup();
		const note = screen.getByText("Only 100 records.");

		expect(note).toHaveClass("bg-surface-sunken");
		expect(note.className).not.toMatch(/\bborder\b/);
	});
});
