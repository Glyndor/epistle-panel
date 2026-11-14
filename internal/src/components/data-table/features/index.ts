import {
	type ColumnDef,
	columnFilteringFeature,
	constructFilterFn,
	createColumnHelper,
	createFilteredRowModel,
	createPaginatedRowModel,
	createSortedRowModel,
	filterFn_includesString,
	globalFilteringFeature,
	metaHelper,
	type RowData,
	rowPaginationFeature,
	rowSortingFeature,
	sortFn_alphanumeric,
	tableFeatures,
} from "@tanstack/react-table";

/**
 * The filter of a facet: keeps a row whose value is one of the ticked options.
 * The match is on the whole value, so an option that is part of another one
 * (`active` inside `inactive`) does not bring the other's rows along. With no
 * option ticked the facet filters nothing.
 */
export const filterFn_oneOf = constructFilterFn({
	filter: (value: unknown, ticked: readonly string[]) =>
		ticked.includes(String(value)),
	autoRemove: (ticked: unknown) =>
		!Array.isArray(ticked) || ticked.length === 0,
});

/** What a column says about itself beyond its cells. */
export interface DataTableColumnMeta {
	/**
	 * Classes for the column's header cell and body cells. A table is a size
	 * container, so a column can leave while the table is narrow
	 * (`hidden @md:table-cell`) and what it showed can move into another cell.
	 */
	className?: string;
}

/**
 * The features every table of the panel registers: sorting, a text filter over
 * the rows it was given, a filter by column for the facets and pages over the
 * rows that are left. Nothing else is registered, so nothing else is bundled
 * (no selection or grouping code).
 */
export const dataTableFeatures = tableFeatures({
	rowSortingFeature,
	columnFilteringFeature,
	globalFilteringFeature,
	rowPaginationFeature,
	sortedRowModel: createSortedRowModel(),
	filteredRowModel: createFilteredRowModel(),
	paginatedRowModel: createPaginatedRowModel(),
	sortFns: { alphanumeric: sortFn_alphanumeric },
	filterFns: {
		includesString: filterFn_includesString,
		oneOf: filterFn_oneOf,
	},
	columnMeta: metaHelper<DataTableColumnMeta>(),
});

/** A column of a panel table. Build them with {@link columnHelper}. */
export type DataTableColumn<TData extends RowData> = ColumnDef<
	typeof dataTableFeatures,
	TData
>;

/** Typed column builder for the panel's tables. */
export function columnHelper<TData extends RowData>() {
	return createColumnHelper<typeof dataTableFeatures, TData>();
}
