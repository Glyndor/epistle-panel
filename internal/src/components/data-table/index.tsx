import {
	type RowData,
	type SortingState,
	useTable,
} from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import { useDeferredValue, useMemo, useRef, useState } from "react";

import { DataTableAnnouncer } from "@/components/data-table/announcer";
import {
	type DataTableFacet,
	type DataTableFiltersMenuProps,
	type FacetSelection,
	NO_FACETS,
	toColumnFilters,
	toggleFacet,
} from "@/components/data-table/facets";
import {
	type DataTableColumn,
	dataTableFeatures,
} from "@/components/data-table/features";
import { DataTableHeader } from "@/components/data-table/header";
import { DataTableNoRows } from "@/components/data-table/no-rows";
import { DataTablePagination } from "@/components/data-table/pagination";
import {
	clampPageIndex,
	DEFAULT_PAGE_SIZE,
	type PageSize,
	pageIndexForSize,
	pageRange,
} from "@/components/data-table/paging";
import { DataTableToolbar } from "@/components/data-table/toolbar";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";

export type {
	DataTableFacet,
	DataTableFiltersMenuProps,
} from "@/components/data-table/facets";
export {
	columnHelper,
	type DataTableColumn,
	type DataTableColumnMeta,
	dataTableFeatures,
} from "@/components/data-table/features";

/** Keeps `data` referentially stable when a query has none yet. */
const NO_ROWS: never[] = [];

/**
 * The facets of a table and the menu that shows them go together, or not at
 * all. The menu is handed in, not imported here: it brings the Radix menu with
 * it, which a table with no facets (the queue, the suppression list, the
 * delivery log) should not carry. Pass `DataTableFiltersMenu` from
 * `data-table/filters-menu`.
 */
type FacetProps =
	| { facets?: undefined; filtersMenu?: undefined }
	| {
			/**
			 * The columns the Filters menu narrows by. Each names a column
			 * whose accessor returns one of the option values.
			 */
			facets: readonly DataTableFacet[];
			/** The component that draws the Filters button and its menu. */
			filtersMenu: React.ComponentType<DataTableFiltersMenuProps>;
	  };

type DataTableProps<TData extends RowData> = FacetProps & {
	columns: DataTableColumn<TData>[];
	data: readonly TData[] | undefined;
	/** Stable id of a row, such as the queue entry id. */
	getRowId: (row: TData) => string;
	/** Visible label of the filter field; it also names the input. */
	filterLabel: string;
	/** Text shown when there are no rows at all. */
	emptyLabel: string;
	/** Extra content on the right of the filter bar, such as the page links. */
	toolbar?: React.ReactNode;
	/**
	 * Split the rows into pages, here in the browser. Turn it off for a list
	 * the server already pages (the queue and the suppression list, which
	 * pass their page links in `toolbar`), so it is not paged twice.
	 */
	pagination?: boolean;
};

/**
 * A compact table with column sorting, a text filter, facets and pages, on
 * TanStack Table.
 *
 * Reads happen in this component's own render (`table.state`, `getRowModel`),
 * so React Compiler sees them: a child that read table state through a builder
 * method would be memoised against a stable object and show stale rows. The
 * parts below it (bar, header, foot, menu) take plain values for that reason.
 *
 * Sorting, filtering and paging are client side, over the rows the query
 * returned, and their state lives in this component: it is not in the URL, so
 * a reload starts again from the first page with no filter. The filter input
 * is urgent and the table follows it through `useDeferredValue`, so typing
 * stays responsive while a long list re-filters. A change of the rows is said
 * to a screen reader by one live region, half a second after they settle.
 *
 * The page goes back to the first one when the order or a filter changes, by
 * hand. The table is given no way to write the page (no `onPaginationChange`)
 * and its own reset is off as well: that reset also fires when the data
 * changes, which would throw the viewer off their page on every refresh. When
 * the list gets shorter under the page on screen, the last page that still
 * has rows is shown instead.
 */
export function DataTable<TData extends RowData>({
	columns,
	data,
	getRowId,
	filterLabel,
	emptyLabel,
	toolbar,
	facets,
	filtersMenu: FiltersMenu,
	pagination: paged = true,
}: DataTableProps<TData>) {
	const t = useTranslations("table");
	const filterInput = useRef<HTMLInputElement>(null);
	const [sorting, setSorting] = useState<SortingState>([]);
	const [filter, setFilter] = useState("");
	const [selection, setSelection] = useState<FacetSelection>(NO_FACETS);
	const [page, setPage] = useState<{ pageIndex: number; pageSize: PageSize }>(
		{ pageIndex: 0, pageSize: DEFAULT_PAGE_SIZE },
	);
	const deferredFilter = useDeferredValue(filter);
	const columnFilters = useMemo(
		() => toColumnFilters(selection),
		[selection],
	);
	const toFirstPage = () =>
		setPage((current) =>
			current.pageIndex === 0 ? current : { ...current, pageIndex: 0 },
		);

	const table = useTable({
		features: dataTableFeatures,
		columns,
		data: (data as TData[] | undefined) ?? (NO_ROWS as TData[]),
		getRowId,
		state: {
			sorting,
			globalFilter: deferredFilter,
			columnFilters,
			pagination: page,
		},
		onSortingChange: (updater) => {
			setSorting(updater);
			toFirstPage();
		},
		globalFilterFn: "includesString",
		defaultColumn: { filterFn: "oneOf" },
		autoResetPageIndex: false,
	});

	const total = data?.length ?? 0;
	const matched = table.getPrePaginatedRowModel().rows.length;
	const pageIndex = clampPageIndex(page.pageIndex, matched, page.pageSize);
	if (paged && pageIndex !== page.pageIndex) {
		// The list got shorter under the page on screen: step back to the
		// last page with rows before anything is painted.
		setPage({ ...page, pageIndex });
	}
	const rows = paged
		? table.getRowModel().rows
		: table.getPrePaginatedRowModel().rows;

	const count = t("rows", { shown: matched, total });
	// What a screen reader is told when the rows change: the range of a paged
	// table, the count of one that is not, or that nothing matches.
	const { from, to } = pageRange(pageIndex, page.pageSize, matched);
	const announcement =
		total === 0
			? ""
			: matched === 0
				? t("noMatches")
				: paged
					? t("range", { from, to, count: matched })
					: count;

	const headerRows = table.getHeaderGroups().map((group) => ({
		id: group.id,
		cells: group.headers.map((header) => {
			const column = header.column;
			const title = column.columnDef.header;
			const sortTitle =
				!header.isPlaceholder &&
				column.getCanSort() &&
				typeof title === "string"
					? title
					: undefined;
			return {
				id: header.id,
				sorted: column.getIsSorted(),
				sortTitle,
				onToggleSort:
					sortTitle === undefined
						? undefined
						: column.getToggleSortingHandler(),
				content: header.isPlaceholder ? null : (
					<table.FlexRender header={header} />
				),
				className: column.columnDef.meta?.className,
			};
		}),
	}));

	return (
		<div className="@container flex flex-col gap-2">
			<DataTableToolbar
				filterLabel={filterLabel}
				filter={filter}
				onFilterChange={(value) => {
					setFilter(value);
					toFirstPage();
				}}
				inputRef={filterInput}
				count={count}
				filters={
					FiltersMenu && facets.length > 0 ? (
						<FiltersMenu
							facets={facets}
							selection={selection}
							onToggle={(columnId, value) => {
								setSelection((current) =>
									toggleFacet(current, columnId, value),
								);
								toFirstPage();
							}}
							onClear={() => {
								setSelection(NO_FACETS);
								toFirstPage();
							}}
						/>
					) : undefined
				}
			>
				{toolbar}
			</DataTableToolbar>
			<Table>
				<DataTableHeader rows={headerRows} />
				<TableBody>
					{rows.length === 0 ? (
						<DataTableNoRows
							colSpan={columns.length}
							emptyLabel={emptyLabel}
							onClearFilters={
								// With rows in the list, only a filter leaves
								// none to show. The text still being typed is
								// not asked: the rows follow it a moment later.
								total > 0
									? () => {
											setFilter("");
											setSelection(NO_FACETS);
											toFirstPage();
											filterInput.current?.focus();
										}
									: undefined
							}
						/>
					) : (
						rows.map((row) => (
							<TableRow key={row.id}>
								{row.getAllCells().map((cell) => (
									<TableCell
										key={cell.id}
										className={
											cell.column.columnDef.meta
												?.className
										}
									>
										<table.FlexRender cell={cell} />
									</TableCell>
								))}
							</TableRow>
						))
					)}
				</TableBody>
			</Table>
			<DataTableAnnouncer message={announcement} />
			{paged && matched > 0 ? (
				<DataTablePagination
					pageIndex={pageIndex}
					pageSize={page.pageSize}
					count={matched}
					onPageChange={(next) =>
						setPage({ ...page, pageIndex: next })
					}
					onPageSizeChange={(pageSize) =>
						setPage({
							pageIndex: pageIndexForSize(
								page.pageIndex,
								page.pageSize,
								pageSize,
							),
							pageSize,
						})
					}
				/>
			) : null}
		</div>
	);
}
