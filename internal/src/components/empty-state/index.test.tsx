import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";

import { EmptyState } from ".";

afterEach(cleanup);

describe("EmptyState", () => {
	it("tells the state in words: a title, one sentence and the next step as a link", () => {
		render(
			<EmptyState
				illustration="tray"
				title="Nothing here"
				description="Write a message to start."
				action={<a href="/write">Write</a>}
			/>,
		);

		expect(screen.getByText("Nothing here")).toHaveAttribute(
			"data-slot",
			"empty-title",
		);
		expect(screen.getByText("Write a message to start.")).toHaveAttribute(
			"data-slot",
			"empty-description",
		);
		expect(screen.getByRole("link", { name: "Write" })).toHaveAttribute(
			"href",
			"/write",
		);
	});

	it("draws its illustration first, hidden from assistive technology, so the words are all that is read", () => {
		const { container } = render(
			<EmptyState illustration="search" title="T" description="D" />,
		);
		const mark = container.querySelector("[data-illustration]");

		expect(mark).toHaveAttribute("data-illustration", "search");
		expect(mark).toHaveAttribute("aria-hidden", "true");
		expect(container.firstElementChild?.firstElementChild).toBe(mark);
		expect(container).toHaveTextContent("TD");
	});

	it("shows no button when there is no step to take", () => {
		render(<EmptyState illustration="globe" title="T" description="D" />);

		expect(screen.queryByRole("link")).toBeNull();
		expect(screen.queryByRole("button")).toBeNull();
	});

	it("passes what the caller needs on the wrapper: a live region, a class", () => {
		const { container } = render(
			<EmptyState
				role="status"
				className="p-4"
				illustration="letter"
				title="T"
				description="D"
			/>,
		);

		const wrapper = screen.getByRole("status");
		expect(wrapper).toHaveAttribute("data-slot", "empty-state");
		expect(wrapper).toHaveClass("p-4");
		expect(wrapper).not.toHaveClass("p-6");
		expect(container.contains(wrapper)).toBe(true);
	});

	it("sends no style attribute and no svg", () => {
		const { container } = render(
			<EmptyState illustration="people" title="T" description="D" />,
		);

		expect(container.querySelector("[style]")).toBeNull();
		expect(container.querySelector("svg")).toBeNull();
	});
});
