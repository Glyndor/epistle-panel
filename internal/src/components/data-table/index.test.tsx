import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { columnHelper, DataTable } from ".";

interface Row {
	name: string;
	kind: string;
}

const helper = columnHelper<Row>();
const columns = helper.columns([
	helper.accessor("name", { header: "Name" }),
	helper.accessor("kind", { header: "Kind", enableSorting: false }),
]);
const rows: Row[] = [
	{ name: "charlie", kind: "x" },
	{ name: "alpha", kind: "y" },
	{ name: "bravo", kind: "x" },
];

afterEach(cleanup);

function renderTable(data: Row[] | undefined) {
	return render(
		<DataTable
			columns={columns}
			data={data}
			getRowId={(row) => row.name}
			filterLabel="Filter"
			emptyLabel="Nothing here"
		/>,
	);
}

const names = () =>
	screen
		.getAllByRole("row")
		.slice(1)
		.map((row) => row.querySelector("td")?.textContent);

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

	it("filters rows by text in any column, and says so when none match", async () => {
		renderTable(rows);
		const input = screen.getByRole("searchbox", { name: "Filter" });

		fireEvent.change(input, { target: { value: "ALP" } });
		await screen.findByText("alpha");
		expect(names()).toEqual(["alpha"]);

		fireEvent.change(input, { target: { value: "zzz" } });
		expect(await screen.findByText("noMatches")).toBeInTheDocument();
	});

	it("shows the empty label when there is no data, and when data has not arrived", () => {
		renderTable([]);
		expect(screen.getByText("Nothing here")).toBeInTheDocument();
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
