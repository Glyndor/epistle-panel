import { afterEach, beforeEach, describe, expect, it, jest } from "bun:test";
import { act, cleanup, fireEvent, screen } from "@testing-library/react";

import {
	currentPage,
	facets,
	many,
	names,
	openFilters,
	press,
	pressPage,
	renderTable,
	search,
	table,
	tick,
} from "@/components/data-table/test-support";

afterEach(cleanup);

describe("DataTable pages", () => {
	it("shows 25 rows to start with and moves through the pages with previous and next", () => {
		renderTable(many(60));

		expect(names()).toHaveLength(25);
		expect(names().at(0)).toBe("row-001");
		expect(names().at(-1)).toBe("row-025");
		expect(currentPage()).toBe("1");

		press("next");
		expect(names().at(0)).toBe("row-026");
		expect(names().at(-1)).toBe("row-050");
		expect(currentPage()).toBe("2");

		press("next");
		expect(names()).toHaveLength(10);
		expect(names().at(-1)).toBe("row-060");

		press("previous");
		expect(names().at(0)).toBe("row-026");
	});

	it("stops at both ends: previous on the first page and next on the last change nothing", () => {
		renderTable(many(30));

		expect(
			screen.getByRole("button", { name: "previous" }),
		).toHaveAttribute("aria-disabled", "true");
		press("previous");
		expect(names().at(0)).toBe("row-001");

		press("next");
		expect(screen.getByRole("button", { name: "next" })).toHaveAttribute(
			"aria-disabled",
			"true",
		);
		press("next");
		expect(names()).toEqual([
			"row-026",
			"row-027",
			"row-028",
			"row-029",
			"row-030",
		]);
	});

	it("goes to the page whose number is pressed", () => {
		renderTable(many(60));

		pressPage("3");
		expect(names().at(0)).toBe("row-051");
		expect(currentPage()).toBe("3");
	});

	it("takes another page size and keeps the row that was first on screen", () => {
		renderTable(many(60));
		const size = screen.getByRole("combobox", { name: "pageSize" });
		expect(size).toHaveValue("25");

		press("next");
		fireEvent.change(size, { target: { value: "10" } });

		// Row 26 was first on screen; with pages of 10 it is on the third.
		expect(names()).toHaveLength(10);
		expect(names().at(0)).toBe("row-021");
		expect(names()).toContain("row-026");
		expect(currentPage()).toBe("3");
	});

	it("goes back to the first page when the order changes", () => {
		renderTable(many(60));
		press("next");

		fireEvent.click(screen.getByRole("button", { name: /Name/ }));
		expect(currentPage()).toBe("1");
		expect(names().at(0)).toBe("row-001");
	});

	it("goes back to the first page when the text filter changes", async () => {
		renderTable(many(60));
		press("next");

		search("row-0");
		await screen.findByText("row-001");
		expect(currentPage()).toBe("1");
		expect(names()).toHaveLength(25);
	});

	it("goes back to the first page when a facet is ticked", async () => {
		renderTable(many(60), { facets });
		press("next");

		await openFilters();
		tick("Active");

		expect(currentPage()).toBe("1");
		expect(names().at(0)).toBe("row-001");
	});

	it("stays on its page when a refresh takes a row away", async () => {
		const data = many(60);
		const view = renderTable(data);
		press("next");

		view.rerender(table(data.filter((row) => row.name !== "row-030")));
		// The table resets its page a moment after its data changes, not in
		// the same render: let that moment pass before looking.
		await act(async () => {});

		expect(currentPage()).toBe("2");
		expect(names()).toHaveLength(25);
		expect(names().at(0)).toBe("row-026");
		expect(names().at(-1)).toBe("row-051");
	});

	it("steps back to the last page with rows when the list gets shorter under it", () => {
		const view = renderTable(many(60));
		pressPage("3");

		view.rerender(table(many(30)));
		expect(currentPage()).toBe("2");
		expect(names()).toEqual([
			"row-026",
			"row-027",
			"row-028",
			"row-029",
			"row-030",
		]);

		view.rerender(table(many(5)));
		// One page: its rows, and no page controls.
		expect(names()).toHaveLength(5);
		expect(screen.queryByRole("navigation")).toBeNull();
	});

	it("shows every row and no page control when paging is off", () => {
		renderTable(many(60), { pagination: false });

		expect(names()).toHaveLength(60);
		expect(screen.queryByRole("navigation")).toBeNull();
		expect(screen.queryByRole("combobox")).toBeNull();
	});

	it("has no page controls for a list that fits one page, only its range and the size", () => {
		renderTable(many(25));

		expect(screen.queryByRole("navigation")).toBeNull();
		expect(screen.getByText("range")).toBeInTheDocument();
		expect(
			screen.getByRole("combobox", { name: "pageSize" }),
		).toBeInTheDocument();
	});

	it("brings the page controls back as soon as the list takes two pages", () => {
		renderTable(many(26));
		expect(screen.getByRole("navigation")).toBeInTheDocument();
		cleanup();

		// 25 rows fit one page of 25, and take three of 10.
		renderTable(many(25));
		fireEvent.change(screen.getByRole("combobox", { name: "pageSize" }), {
			target: { value: "10" },
		});
		expect(screen.getByRole("navigation")).toBeInTheDocument();
	});
});

describe("DataTable announcements", () => {
	beforeEach(() => {
		jest.useFakeTimers();
	});
	afterEach(() => {
		jest.useRealTimers();
	});

	const pass = (ms: number) =>
		act(() => {
			jest.advanceTimersByTime(ms);
		});
	const region = () => {
		const regions = document.querySelectorAll('[aria-live="polite"]');
		expect(regions).toHaveLength(1);
		return regions[0] as HTMLElement;
	};

	it("has one live region, off the screen, and none of the visible sentences is one", () => {
		renderTable(many(60));

		expect(region()).toHaveClass("sr-only");
		expect(region().textContent).toBe("");
		expect(screen.getByText("range")).not.toHaveAttribute("aria-live");
		expect(screen.getByText("rows")).not.toHaveAttribute("aria-live");
	});

	it("says that no row matches half a second after the filter leaves none, and then keeps the sentence once in the page", () => {
		renderTable(many(60));

		search("zzz");
		expect(region().textContent).toBe("");
		pass(500);
		expect(region().textContent).toBe("noMatches");
		expect(screen.getAllByText("noMatches")).toHaveLength(2);

		pass(2500);
		expect(region().textContent).toBe("");
		// At rest the sentence is in the table only.
		expect(screen.getAllByText("noMatches")).toHaveLength(1);
	});

	it("says the range again when the rows come back", () => {
		renderTable(many(60));
		search("zzz");
		pass(3000);

		search("");
		pass(500);
		expect(region().textContent).toBe("range");
	});

	it("says the count of a table that is not paged", () => {
		renderTable(many(60), { pagination: false });
		search("zzz");
		pass(3000);

		search("");
		expect(region().textContent).toBe("");
		pass(500);
		expect(region().textContent).toBe("rows");
	});

	it("has nothing to say of a list with no rows", () => {
		renderTable([]);

		pass(5000);
		expect(region().textContent).toBe("");
	});
});
