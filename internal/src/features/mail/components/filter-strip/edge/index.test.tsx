import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, fireEvent, render } from "@testing-library/react";

import { Edge } from ".";

afterEach(cleanup);

function edge(side: "start" | "end" = "end") {
	const seen = { presses: 0 };
	const view = render(
		<Edge
			side={side}
			onPress={() => {
				seen.presses += 1;
			}}
		/>,
	);
	const button = view.container.querySelector<HTMLElement>("[data-edge]");
	const circle = view.container.querySelector<HTMLElement>(
		"[data-slot='edge-press']",
	);
	if (button === null || circle === null) {
		throw new Error("no edge");
	}
	return { seen, button, circle };
}

describe("Edge", () => {
	it("says which end it is of, and is out of the tab order and of the accessibility tree", () => {
		const { button } = edge("start");

		expect(button).toHaveAttribute("data-edge", "start");
		expect(button).toHaveAttribute("tabindex", "-1");
		expect(button).toHaveAttribute("aria-hidden", "true");
		expect(button).toHaveClass("start-0");
		expect(edge("end").button).toHaveClass("end-0");
	});

	it("moves the strip on a press of its circle, and keeps the focus where it was", () => {
		const { seen, button, circle } = edge();

		const down = fireEvent.mouseDown(circle);
		fireEvent.click(circle);

		expect(seen.presses).toBe(1);
		// The default of a mouse press is to take the focus: prevented.
		expect(down).toBe(false);
		expect(document.activeElement).not.toBe(button);
	});

	it("takes a press on its circle only: the fade lets it through to the filter under it", () => {
		const { button, circle } = edge();

		expect(button).toHaveClass("pointer-events-none");
		expect(circle).toHaveClass("pointer-events-auto", "size-6");
	});

	it("is not drawn while the keyboard's focus is in the strip, so no ring is veiled", () => {
		expect(edge().button).toHaveClass(
			"group-has-[:focus-visible]/strip:hidden",
		);
	});
});
