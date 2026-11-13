import { afterEach, describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	within,
} from "@testing-library/react";

import {
	columns,
	facets,
	helper,
	names,
	openFilters,
	renderTable,
	rows,
	search,
	tick,
} from "@/components/data-table/test-support";

import { DataTable } from ".";

afterEach(cleanup);

describe("DataTable", () => {
	it("renders a header and one row per datum, with the count", () => {
		renderTable(rows);

		expect(screen.getAllByRole("columnheader")).toHaveLength(2);
		expect(names()).toEqual(["charlie", "alpha", "bravo"]);
		expect(screen.getByText("rows")).toBeInTheDocument();
	});

	it("sorts a sortable column ascending, then descending, and marks it with aria-sort", () => {
		renderTable(rows);
		const header = screen.getByRole("columnheader", { name: /Name/ });
		const toggle = screen.getByRole("button", { name: /Name/ });

		fireEvent.click(toggle);
		expect(names()).toEqual(["alpha", "bravo", "charlie"]);
		expect(header).toHaveAttribute("aria-sort", "ascending");

		fireEvent.click(toggle);
		expect(names()).toEqual(["charlie", "bravo", "alpha"]);
		expect(header).toHaveAttribute("aria-sort", "descending");
	});

	it("gives an unsortable column no sort button", () => {
		renderTable(rows);

		expect(screen.queryByRole("button", { name: /Kind/ })).toBeNull();
		expect(
			screen.getByRole("columnheader", { name: "Kind" }),
		).not.toHaveAttribute("aria-sort");
	});

	it("filters rows by text, and when none match says so and offers the way back", async () => {
		renderTable(rows);
		const input = screen.getByRole("searchbox", { name: "Filter" });

		search("ALP");
		await screen.findByText("alpha");
		expect(names()).toEqual(["alpha"]);

		search("zzz");
		const clear = await screen.findByRole("button", {
			name: "clearFilters",
		});
		expect(
			within(screen.getByRole("table")).getByText("noMatches"),
		).toBeInTheDocument();
		// With no row to page, the foot is away: no range, no page size.
		expect(screen.queryByText("range")).toBeNull();
		expect(screen.queryByRole("combobox")).toBeNull();

		fireEvent.click(clear);
		await screen.findByText("charlie");
		expect(names()).toEqual(["charlie", "alpha", "bravo"]);
		expect(input).toHaveValue("");
		expect(document.activeElement).toBe(input);
	});

	it("shows the empty label when there is no data, with no way back to offer and no pages", () => {
		renderTable([]);
		expect(screen.getByText("Nothing here")).toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: "clearFilters" }),
		).toBeNull();
		expect(screen.queryByRole("navigation")).toBeNull();
		cleanup();

		renderTable(undefined);
		expect(screen.getByText("Nothing here")).toBeInTheDocument();
	});

	it("renders the toolbar content beside the filter", () => {
		render(
			<DataTable
				columns={columns}
				data={rows}
				getRowId={(row) => row.name}
				filterLabel="Filter"
				emptyLabel="none"
				toolbar={<a href="/next">Next</a>}
			/>,
		);

		expect(screen.getByRole("link", { name: "Next" })).toBeInTheDocument();
	});
});

describe("DataTable columns", () => {
	it("gives a column's own classes to its header and to each of its cells, and to no other", () => {
		render(
			<DataTable
				columns={helper.columns([
					helper.accessor("name", { header: "Name" }),
					helper.accessor("kind", {
						header: "Kind",
						meta: { className: "hidden @md:table-cell" },
					}),
				])}
				data={rows}
				getRowId={(row) => row.name}
				filterLabel="Filter"
				emptyLabel="none"
			/>,
		);

		const [nameHeader, kindHeader] = screen.getAllByRole("columnheader");
		expect(kindHeader).toHaveClass("hidden", "@md:table-cell");
		expect(nameHeader).not.toHaveClass("hidden");
		const cells = screen.getAllByRole("cell");
		expect(cells).toHaveLength(6);
		cells.forEach((cell, index) => {
			if (index % 2 === 1) {
				expect(cell).toHaveClass("hidden", "@md:table-cell");
			} else {
				expect(cell).not.toHaveClass("hidden");
			}
		});
	});

	it("is a size container, so a column can answer to the table's own width", () => {
		const { container } = renderTable(rows);

		expect(container.querySelector("main")?.firstElementChild).toHaveClass(
			"@container",
		);
	});
});

describe("DataTable facets", () => {
	it("has its Filters button in the first paint, ready to be pressed", () => {
		renderTable(rows, { facets });

		// No stand-in to wait behind: a press right after the page appears
		// must not be lost.
		const button = screen.getByRole("button", { name: /filters/ });
		expect(button).toBeEnabled();
		expect(button).toHaveAttribute("aria-expanded", "false");
		fireEvent.keyDown(button, { key: "Enter" });
		expect(button).toHaveAttribute("aria-expanded", "true");
	});

	it("has no Filters button without facets", () => {
		renderTable(rows);

		expect(screen.queryByRole("button", { name: /filters/ })).toBeNull();
	});

	it("keeps the rows whose value is exactly a ticked option, and all of them again once unticked", async () => {
		renderTable(rows, { facets });
		await openFilters();

		// "active" is part of "inactive": only the whole value counts.
		tick("Active");
		expect(names()).toEqual(["charlie", "bravo"]);

		tick("Inactive");
		expect(names()).toEqual(["charlie", "alpha", "bravo"]);

		tick("Active");
		expect(names()).toEqual(["alpha"]);

		tick("Inactive");
		expect(names()).toEqual(["charlie", "alpha", "bravo"]);
	});

	it("narrows by the facet and the text together", async () => {
		renderTable(rows, { facets });
		await openFilters();
		tick("Active");

		search("bra");
		await screen.findByText("bravo");
		expect(names()).toEqual(["bravo"]);
	});

	it("takes every tick off from the menu, and leaves the text filter alone", async () => {
		renderTable(rows, { facets });
		search("a");
		await openFilters();
		tick("Inactive");
		expect(names()).toEqual(["alpha"]);

		fireEvent.click(screen.getByRole("menuitem", { name: "deselectAll" }));

		expect(names()).toEqual(["charlie", "alpha", "bravo"]);
		expect(screen.getByRole("searchbox", { name: "Filter" })).toHaveValue(
			"a",
		);
	});

	it("offers the way back when the facets leave no row, and it takes them off", async () => {
		renderTable(
			rows.filter((row) => row.kind === "active"),
			{ facets },
		);
		await openFilters();
		tick("Inactive");

		fireEvent.click(
			within(screen.getByRole("table")).getByRole("button", {
				name: "clearFilters",
			}),
		);

		expect(names()).toEqual(["charlie", "bravo"]);
	});
});

/**
 * Who brings the Filters menu, read from the sources. The menu needs the Radix
 * menu and its popper, about 19 kB compressed: a table with no facets must not
 * carry them, so `DataTable` and its parts do not import the menu, and the
 * tables that have facets import it themselves. They import it with the page,
 * not apart: loaded apart, a press on the button while its code was on the way
 * was lost.
 */
describe("the Filters menu and the code a table carries", () => {
	const SRC = join(import.meta.dir, "..", "..");
	const read = (file: string) => readFileSync(join(SRC, file), "utf8");
	const MENU = /from "@\/components\/data-table\/filters-menu"/;
	const WITH_FACETS = [
		"features/accounts/components/accounts-table/index.tsx",
		"features/domains/components/domains-table/index.tsx",
	];
	const tables = Array.from(
		new Bun.Glob("features/*/components/*-table/index.tsx").scanSync(SRC),
	).sort();

	it("is not imported by the table or by any part of it", () => {
		const parts = Array.from(
			new Bun.Glob("components/data-table/**/*.{ts,tsx}").scanSync(SRC),
		).filter(
			(file) =>
				!file.includes(".test.") &&
				!file.includes("/test-support/") &&
				!file.includes("/filters-menu/"),
		);
		expect(parts).toContain("components/data-table/index.tsx");
		expect(parts.filter((file) => MENU.test(read(file)))).toEqual([]);
	});

	it("is imported, with the page, by the tables that pass facets and by no other", () => {
		expect(tables).toHaveLength(5);
		expect(tables.filter((file) => MENU.test(read(file)))).toEqual(
			WITH_FACETS,
		);
		expect(tables.filter((file) => /\bfacets=\{/.test(read(file)))).toEqual(
			WITH_FACETS,
		);
	});

	it("is loaded apart by no table and by no part of the table", () => {
		const all = [
			...tables,
			...Array.from(
				new Bun.Glob("components/data-table/**/*.tsx").scanSync(SRC),
			).filter((file) => !file.includes(".test.")),
		];
		expect(
			all.filter((file) => /next\/dynamic|\bimport\(/.test(read(file))),
		).toEqual([]);
	});
});
