import { afterEach, describe, expect, it, mock } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { Table } from "@/components/ui/table";

import { DataTableHeader, type HeaderCell } from ".";

afterEach(cleanup);

const cell = (over: Partial<HeaderCell> = {}): HeaderCell => ({
	id: "name",
	sorted: false,
	sortTitle: "Name",
	onToggleSort: undefined,
	content: null,
	...over,
});
const setup = (cells: HeaderCell[]) =>
	render(
		<Table>
			<DataTableHeader rows={[{ id: "0", cells }]} />
		</Table>,
	);

describe("DataTableHeader", () => {
	it("gives a sortable column a button that changes its order, and says it can be sorted", () => {
		const onToggleSort = mock((_event: unknown) => {});
		setup([cell({ onToggleSort })]);
		const header = screen.getByRole("columnheader", { name: /Name/ });

		expect(header).toHaveAttribute("scope", "col");
		expect(header).not.toHaveAttribute("aria-sort");
		// The panel's own button: a fill on hover, another on a press, a colour
		// transition, and 44 px both ways on a coarse pointer.
		const sort = screen.getByRole("button", { name: "Name sortable" });
		expect(sort).toHaveAttribute("data-slot", "button");
		expect(sort).toHaveAttribute("data-variant", "ghost");
		expect(sort).toHaveClass(
			"min-h-6",
			"pointer-coarse:min-h-11",
			"pointer-coarse:min-w-11",
			"hover:bg-accent",
			"active:bg-accent/70",
			"transition-colors",
			"text-sm",
		);
		expect(sort).not.toHaveClass("text-xs");
		// Pulled back by its own padding, on either pointer, so its text
		// starts where the cells' text does.
		expect(sort).toHaveClass("-mx-2", "pointer-coarse:-mx-3");
		// Scrolled into view by the keyboard, it keeps room for its focus ring:
		// flush against the edge of the scrolling table the ring was cut.
		expect(sort).toHaveClass("scroll-mx-2");
		fireEvent.click(screen.getByRole("button", { name: /Name/ }));
		expect(onToggleSort).toHaveBeenCalledTimes(1);
	});

	it("says the order a column is in, to the eye and to a screen reader", () => {
		setup([
			cell({ id: "a", sorted: "asc", sortTitle: "Up" }),
			cell({ id: "d", sorted: "desc", sortTitle: "Down" }),
		]);

		expect(
			screen.getByRole("columnheader", { name: /Up/ }),
		).toHaveAttribute("aria-sort", "ascending");
		expect(
			screen.getByRole("button", { name: "Up sortedAscending" }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("columnheader", { name: /Down/ }),
		).toHaveAttribute("aria-sort", "descending");
		expect(
			screen.getByRole("button", { name: "Down sortedDescending" }),
		).toBeInTheDocument();
	});

	it("shows the content of a column that cannot be sorted, with no button", () => {
		setup([
			cell({
				id: "actions",
				sortTitle: undefined,
				content: <span>Actions</span>,
			}),
		]);

		expect(
			screen.getByRole("columnheader", { name: "Actions" }),
		).toBeInTheDocument();
		expect(screen.queryByRole("button")).toBeNull();
	});

	describe("a sort button the keyboard reaches", () => {
		const original = Element.prototype.scrollIntoView;
		const matches = Element.prototype.matches;
		afterEach(() => {
			Element.prototype.scrollIntoView = original;
			Element.prototype.matches = matches;
		});
		/** Stand for the browser's answer to `:focus-visible`, which the test DOM does not track. */
		const keyboardFocus = (byKeyboard: boolean) => {
			Element.prototype.matches = function (
				this: Element,
				selector: string,
			) {
				return selector === ":focus-visible"
					? byKeyboard
					: matches.call(this, selector);
			} as typeof Element.prototype.matches;
		};

		it("is brought into the table's scroll box, by the nearest edge", () => {
			const scrollIntoView = mock((_options?: unknown) => {});
			Element.prototype.scrollIntoView = scrollIntoView;
			keyboardFocus(true);
			setup([cell()]);

			fireEvent.focus(screen.getByRole("button", { name: /Name/ }));

			expect(scrollIntoView).toHaveBeenCalledTimes(1);
			expect(scrollIntoView).toHaveBeenCalledWith({
				block: "nearest",
				inline: "nearest",
			});
		});

		it("is left where it is when a pointer gave it the focus, so the click still lands", () => {
			const scrollIntoView = mock((_options?: unknown) => {});
			Element.prototype.scrollIntoView = scrollIntoView;
			keyboardFocus(false);
			setup([cell()]);

			fireEvent.focus(screen.getByRole("button", { name: /Name/ }));

			expect(scrollIntoView).not.toHaveBeenCalled();
		});
	});
});
