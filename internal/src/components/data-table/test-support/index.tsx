import { fireEvent, render, screen } from "@testing-library/react";

import {
	columnHelper,
	DataTable,
	type DataTableFacet,
} from "@/components/data-table";
import { DataTableFiltersMenu } from "@/components/data-table/filters-menu";

/** The row of the table the tests of `DataTable` share. */
export interface Row {
	name: string;
	kind: string;
}

export const helper = columnHelper<Row>();
export const columns = helper.columns([
	helper.accessor("name", { header: "Name" }),
	helper.accessor("kind", {
		header: "Kind",
		enableSorting: false,
		enableGlobalFilter: false,
	}),
]);
export const rows: Row[] = [
	{ name: "charlie", kind: "active" },
	{ name: "alpha", kind: "inactive" },
	{ name: "bravo", kind: "active" },
];
/** `count` rows named `row-001` onwards, every third one inactive. */
export const many = (count: number): Row[] =>
	Array.from({ length: count }, (_, index) => ({
		name: `row-${String(index + 1).padStart(3, "0")}`,
		kind: index % 3 === 2 ? "inactive" : "active",
	}));
export const facets: DataTableFacet[] = [
	{
		columnId: "kind",
		label: "Kind",
		options: [
			{ value: "active", label: "Active" },
			{ value: "inactive", label: "Inactive" },
		],
	},
];

type Extra = { facets?: DataTableFacet[]; pagination?: boolean };

/** The facets with the menu that shows them, as a table with facets passes the two. */
const withMenu = ({ facets: given, ...rest }: Extra) =>
	given
		? { ...rest, facets: given, filtersMenu: DataTableFiltersMenu }
		: rest;

/** The table inside the page's `main`, where the Filters menu is rendered. */
export const table = (data: Row[] | undefined, extra: Extra = {}) => (
	<main id="main-content">
		<DataTable
			columns={columns}
			data={data}
			getRowId={(row) => row.name}
			filterLabel="Filter"
			emptyLabel="Nothing here"
			{...withMenu(extra)}
		/>
	</main>
);
export const renderTable = (data: Row[] | undefined, extra: Extra = {}) =>
	render(table(data, extra));

/** The first cell of every body row, in order. */
export const names = () =>
	screen
		.getAllByRole("row")
		.slice(1)
		.map((row) => row.querySelector("td")?.textContent);
export const currentPage = () =>
	screen.getByRole("button", { current: "page" }).textContent;
export const press = (name: "next" | "previous") =>
	fireEvent.click(screen.getByRole("button", { name }));
export const pressPage = (number: string) => {
	const button = screen
		.getAllByRole("button", { name: "page" })
		.find((candidate) => candidate.textContent === number);
	if (!button) {
		throw new Error(`no button for page ${number}`);
	}
	fireEvent.click(button);
};
export const search = (value: string) =>
	fireEvent.change(screen.getByRole("searchbox", { name: "Filter" }), {
		target: { value },
	});
/** Open the Filters menu from the keyboard, and wait for its list. */
export const openFilters = async () => {
	fireEvent.keyDown(
		await screen.findByRole("button", { name: /filters/, expanded: false }),
		{ key: "Enter" },
	);
	return screen.findByRole("menu");
};
export const tick = (name: string) =>
	fireEvent.click(screen.getByRole("menuitemcheckbox", { name }));
