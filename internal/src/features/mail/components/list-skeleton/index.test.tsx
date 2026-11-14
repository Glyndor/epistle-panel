import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";

import { ListSkeleton } from ".";

afterEach(cleanup);

describe("ListSkeleton", () => {
	it("says once that the messages are loading", () => {
		const { container } = render(<ListSkeleton />);

		expect(screen.getAllByRole("status")).toHaveLength(1);
		expect(screen.getByRole("status")).toHaveTextContent("loading");
		expect(container.firstElementChild).toHaveAttribute(
			"aria-busy",
			"true",
		);
	});

	it("holds the place of a date heading and of six rows, the heading right on its rows as in the list", () => {
		const { container } = render(<ListSkeleton />);
		const frame = container.firstElementChild;
		const heading = container.querySelector(".h-8");
		const rows = heading?.nextElementSibling;

		expect(
			container.querySelectorAll('[data-slot="row-skeleton"]'),
		).toHaveLength(6);
		// A gap between the heading and the rows moved the first message by its size.
		expect(frame?.className).not.toMatch(/(^|\s)(gap|space-y)-/);
		expect(rows).toHaveClass("flex", "flex-col", "gap-1");
		expect(rows?.children).toHaveLength(6);
	});

	it("never moves: no animation and no style attribute", () => {
		const { container } = render(<ListSkeleton />);

		expect(container.innerHTML).not.toMatch(/animate-|transition/);
		expect(container.querySelector("[style]")).toBeNull();
	});
});
