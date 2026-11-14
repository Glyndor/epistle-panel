import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { ChartData } from ".";

afterEach(cleanup);

const setup = () =>
	render(
		<ChartData label="View data">
			<p>the table</p>
		</ChartData>,
	);

describe("ChartData", () => {
	it("is closed to start with: the button says so and the table is not in the page", () => {
		setup();

		expect(
			screen.getByRole("button", { name: "View data" }),
		).toHaveAttribute("aria-expanded", "false");
		expect(screen.queryByText("the table")).toBeNull();
	});

	it("opens the table from its button and closes it again", () => {
		setup();
		const button = screen.getByRole("button", { name: "View data" });

		fireEvent.click(button);
		expect(button).toHaveAttribute("aria-expanded", "true");
		expect(screen.getByText("the table")).toBeVisible();

		fireEvent.click(button);
		expect(button).toHaveAttribute("aria-expanded", "false");
		expect(screen.queryByText("the table")).toBeNull();
	});

	it("leaves the button its hover and press looks when the table is open", () => {
		setup();
		const button = screen.getByRole("button", { name: "View data" });

		fireEvent.click(button);

		// A fill of its own for the open state would be the fill of the hover.
		expect(button.className).not.toMatch(/data-\[state=open\]:bg-/);
		expect(button).toHaveClass("hover:bg-accent");
	});

	it("has a button a finger can press, and no icon drawn as svg", () => {
		const { container } = setup();
		const button = screen.getByRole("button", { name: "View data" });

		expect(button).toHaveClass("pointer-coarse:min-h-11");
		expect(container.querySelector("svg")).toBeNull();
	});

	it("puts no style attribute in what the server would send", () => {
		const { container } = setup();

		expect(container.querySelector("[style]")).toBeNull();
	});
});
