import { afterEach, describe, expect, it, mock } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";

import { DataTableToolbar } from ".";

afterEach(cleanup);

function setup(
	over: { filters?: React.ReactNode; children?: React.ReactNode } = {},
) {
	const onFilterChange = mock((_value: string) => {});
	const inputRef = createRef<HTMLInputElement>();
	render(
		<DataTableToolbar
			filterLabel="Filter accounts"
			filter="ali"
			onFilterChange={onFilterChange}
			inputRef={inputRef}
			count="3 of 12 rows"
			filters={over.filters}
		>
			{over.children}
		</DataTableToolbar>,
	);
	return { onFilterChange, inputRef };
}

describe("DataTableToolbar", () => {
	it("has a named search field that holds the filter and takes at most 254 characters", () => {
		const { inputRef } = setup();
		const input = screen.getByRole("searchbox", {
			name: "Filter accounts",
		});

		expect(input).toHaveValue("ali");
		expect(input).toHaveAttribute("maxlength", "254");
		// Named, so the browser can offer what was typed before.
		expect(input).toHaveAttribute("name", "filter");
		expect(inputRef.current).toBe(input as HTMLInputElement);
	});

	it("reports what is typed", () => {
		const { onFilterChange } = setup();

		fireEvent.change(screen.getByRole("searchbox"), {
			target: { value: "alice" },
		});

		expect(onFilterChange).toHaveBeenCalledWith("alice");
	});

	it("shows the count, and leaves saying a change of it to the table's announcer", () => {
		setup();

		expect(screen.getByText("3 of 12 rows")).not.toHaveAttribute(
			"aria-live",
		);
	});

	it("puts the Filters menu after the field and the page's own content at the end", () => {
		setup({
			filters: <button type="button">Filters</button>,
			children: <a href="/next">Next</a>,
		});

		const order = [
			screen.getByRole("searchbox"),
			screen.getByRole("button", { name: "Filters" }),
			screen.getByText("3 of 12 rows"),
			screen.getByRole("link", { name: "Next" }),
		];
		for (let index = 1; index < order.length; index++) {
			expect(
				(order[index - 1] as HTMLElement).compareDocumentPosition(
					order[index] as HTMLElement,
				) & Node.DOCUMENT_POSITION_FOLLOWING,
			).toBeTruthy();
		}
		expect(
			screen.getByRole("link", { name: "Next" }).parentElement,
		).toHaveClass("ms-auto");
	});
});
