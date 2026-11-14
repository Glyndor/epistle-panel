import { afterEach, describe, expect, it, mock } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import {
	Pagination,
	PaginationContent,
	PaginationEllipsis,
	PaginationItem,
	PaginationLink,
	PaginationNext,
	PaginationPrevious,
} from ".";

afterEach(cleanup);

function setup(
	over: {
		onPrevious?: () => void;
		onPage?: () => void;
		atStart?: boolean;
	} = {},
) {
	return render(
		<Pagination aria-label="Pages">
			<PaginationContent>
				<PaginationItem>
					<PaginationPrevious
						disabled={over.atStart ?? false}
						onClick={over.onPrevious}
					>
						Previous
					</PaginationPrevious>
				</PaginationItem>
				<PaginationItem>
					<PaginationLink aria-label="Page 1" onClick={over.onPage}>
						1
					</PaginationLink>
				</PaginationItem>
				<PaginationItem>
					<PaginationLink isActive aria-label="Page 2">
						2
					</PaginationLink>
				</PaginationItem>
				<PaginationItem aria-hidden="true">
					<PaginationEllipsis />
				</PaginationItem>
				<PaginationItem>
					<PaginationNext>Next</PaginationNext>
				</PaginationItem>
			</PaginationContent>
		</Pagination>,
	);
}

describe("Pagination", () => {
	it("is a named navigation landmark around a list of controls", () => {
		setup();

		const nav = screen.getByRole("navigation", { name: "Pages" });
		expect(nav.querySelector("ul")).not.toBeNull();
		expect(nav.querySelectorAll("li")).toHaveLength(5);
	});

	it("draws its controls as buttons that do not submit a form, and runs their handler", () => {
		const onPage = mock(() => {});
		setup({ onPage });
		const one = screen.getByRole("button", { name: "Page 1" });

		expect(one.tagName).toBe("BUTTON");
		expect(one).toHaveAttribute("type", "button");
		fireEvent.click(one);
		expect(onPage).toHaveBeenCalledTimes(1);
	});

	it("marks the page on screen with aria-current and a filled button, and no other", () => {
		setup();

		const current = screen.getByRole("button", { name: "Page 2" });
		expect(current).toHaveAttribute("aria-current", "page");
		expect(current).toHaveClass("bg-primary", "text-primary-foreground");
		const other = screen.getByRole("button", { name: "Page 1" });
		expect(other).not.toHaveAttribute("aria-current");
		expect(other).not.toHaveClass("bg-primary");
		expect(screen.getAllByRole("button", { current: "page" })).toHaveLength(
			1,
		);
	});

	it("keeps a control with nowhere to go in the tab order, says so and does nothing", () => {
		const onPrevious = mock(() => {});
		setup({ atStart: true, onPrevious });
		const previous = screen.getByRole("button", { name: "Previous" });

		expect(previous).toHaveAttribute("aria-disabled", "true");
		// Not the `disabled` attribute: a focused button that gets it loses the focus.
		expect(previous).not.toBeDisabled();
		expect(previous).toHaveClass("aria-disabled:pointer-events-none");
		fireEvent.click(previous);
		expect(onPrevious).not.toHaveBeenCalled();
	});

	it("runs the handler of a control that has somewhere to go, and does not mark it", () => {
		const onPrevious = mock(() => {});
		setup({ onPrevious });
		const previous = screen.getByRole("button", { name: "Previous" });

		expect(previous).not.toHaveAttribute("aria-disabled");
		fireEvent.click(previous);
		expect(onPrevious).toHaveBeenCalledTimes(1);
	});

	it("names previous and next by their text, with a decorative arrow", () => {
		setup();

		for (const name of ["Previous", "Next"]) {
			const control = screen.getByRole("button", { name });
			expect(control.querySelector("svg")).toHaveAttribute(
				"aria-hidden",
				"true",
			);
		}
	});

	it("is 32 px on a fine pointer and 44 px on a coarse one, with the focus ring and no inline style", () => {
		const { container } = setup();

		for (const control of screen.getAllByRole("button")) {
			expect(control).toHaveClass(
				"min-h-8",
				"min-w-8",
				"pointer-coarse:min-h-11",
				"pointer-coarse:min-w-11",
				"focus-visible:outline-2",
				"focus-visible:outline-ring",
			);
			expect(control).not.toHaveClass("outline-none");
		}
		expect(container.querySelector("[style]")).toBeNull();
	});

	it("hides the mark of the pages left out from a screen reader", () => {
		const { container } = setup();

		const mark = container.querySelector(
			'[data-slot="pagination-ellipsis"]',
		);
		expect(mark).toHaveAttribute("aria-hidden", "true");
		expect(mark).toHaveClass("size-8", "pointer-coarse:size-11");
	});

	it("renders the child as the control with asChild, for a list the server pages", () => {
		render(
			<Pagination aria-label="Pages">
				<PaginationContent>
					<PaginationItem>
						<PaginationLink asChild isActive>
							<a href="?page=2">2</a>
						</PaginationLink>
					</PaginationItem>
				</PaginationContent>
			</Pagination>,
		);

		const link = screen.getByRole("link", { name: "2" });
		expect(link).toHaveAttribute("href", "?page=2");
		expect(link).toHaveAttribute("aria-current", "page");
		expect(link).not.toHaveAttribute("type");
		expect(screen.queryByRole("button")).toBeNull();
	});

	it("dims what an end control holds, not the control, so its focus ring keeps its contrast", () => {
		setup({ atStart: true });

		for (const name of ["Previous", "Next"]) {
			const control = screen.getByRole("button", { name });
			// The ring is drawn by the button: an opacity on it would fade the ring too.
			expect(control).not.toHaveClass("aria-disabled:opacity-50");
			expect(control).toHaveClass("group/link");
			const parts = [...control.children];
			expect(
				parts.map((part) => part.tagName.toLowerCase()).sort(),
			).toEqual(["span", "svg"]);
			for (const part of parts) {
				expect(part).toHaveClass("group-aria-disabled/link:opacity-50");
			}
		}
	});
});
