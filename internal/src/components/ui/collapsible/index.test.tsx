import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from ".";

afterEach(cleanup);

function setup() {
	return render(
		<Collapsible>
			<CollapsibleTrigger>All headers</CollapsibleTrigger>
			<CollapsibleContent>
				<p>Received: from somewhere</p>
			</CollapsibleContent>
		</Collapsible>,
	);
}

describe("Collapsible", () => {
	it("is closed to start with: the button says so and the content is not in the page", () => {
		setup();

		expect(
			screen.getByRole("button", { name: "All headers" }),
		).toHaveAttribute("aria-expanded", "false");
		expect(screen.queryByText("Received: from somewhere")).toBeNull();
	});

	it("opens and closes from its button, which names what it controls", () => {
		setup();
		const button = screen.getByRole("button", { name: "All headers" });

		fireEvent.click(button);
		expect(button).toHaveAttribute("aria-expanded", "true");
		const content = screen.getByText("Received: from somewhere");
		expect(content).toBeVisible();
		expect(button.getAttribute("aria-controls")).toBe(
			content.parentElement?.id ?? "",
		);

		fireEvent.click(button);
		expect(button).toHaveAttribute("aria-expanded", "false");
		expect(screen.queryByText("Received: from somewhere")).toBeNull();
	});

	it("puts no style attribute in what the server would send", () => {
		const { container } = setup();

		expect(container.querySelector("[style]")).toBeNull();
	});
});
