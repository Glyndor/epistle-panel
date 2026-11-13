"use client";

import {
	type ColumnDef,
	columnFilteringFeature,
	createColumnHelper,
	createFilteredRowModel,
	createSortedRowModel,
	filterFn_includesString,
	globalFilteringFeature,
	type RowData,
	rowSortingFeature,
	type SortingState,
	sortFn_alphanumeric,
	tableFeatures,
	useTable,
} from "@tanstack/react-table";
import {
	ArrowDownIcon,
	ArrowUpDownIcon,
	ArrowUpIcon,
	InboxIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useDeferredValue, useState } from "react";

import { Empty, EmptyDescription, EmptyIcon } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";

/**
 * The features every table of the panel registers: sorting and a text filter
 * over the rows it was given. Nothing else is registered, so nothing else is
 * bundled (no pagination, selection or grouping code). The server owns
 * pagination for the queue, through its cursor.
 */
export const dataTableFeatures = tableFeatures({
	rowSortingFeature,
	columnFilteringFeature,
	globalFilteringFeature,
	sortedRowModel: createSortedRowModel(),
	filteredRowModel: createFilteredRowModel(),
	sortFns: { alphanumeric: sortFn_alphanumeric },
	filterFns: { includesString: filterFn_includesString },
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

/** Keeps `data` referentially stable when a query has none yet. */
const NO_ROWS: never[] = [];

interface DataTableProps<TData extends RowData> {
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
}

/**
 * A compact table with column sorting and a text filter, on TanStack Table.
 *
 * Reads happen in this component's own render (`table.state`, `getRowModel`),
 * so React Compiler sees them: a child that read table state through a builder
 * method would be memoised against a stable object and show stale rows. Sorting
 * and filtering are client side, over the rows the query returned. The filter
 * input is urgent and the table follows it through `useDeferredValue`, so typing
 * stays responsive while a long list re-filters.
 */
export function DataTable<TData extends RowData>({
	columns,
	data,
	getRowId,
	filterLabel,
	emptyLabel,
	toolbar,
}: DataTableProps<TData>) {
	const t = useTranslations("table");
	const [sorting, setSorting] = useState<SortingState>([]);
	const [filter, setFilter] = useState("");
	const deferredFilter = useDeferredValue(filter);

	const table = useTable({
		features: dataTableFeatures,
		columns,
		data: (data as TData[] | undefined) ?? (NO_ROWS as TData[]),
		getRowId,
		state: { sorting, globalFilter: deferredFilter },
		onSortingChange: setSorting,
		onGlobalFilterChange: setFilter,
		globalFilterFn: "includesString",
	});

	const rows = table.getRowModel().rows;
	const total = data?.length ?? 0;

	return (
		<div className="flex flex-col gap-2">
			<div className="flex flex-wrap items-center gap-2">
				<Input
					type="search"
					value={filter}
					onChange={(event) => setFilter(event.target.value)}
					aria-label={filterLabel}
					placeholder={filterLabel}
					className="max-w-64"
				/>
				<p className="text-muted-foreground" aria-live="polite">
					{t("rows", { shown: rows.length, total })}
				</p>
				{toolbar ? (
					<div className="ms-auto flex items-center gap-2">
						{toolbar}
					</div>
				) : null}
			</div>
			<Table>
				<TableHeader>
					{table.getHeaderGroups().map((group) => (
						<TableRow key={group.id}>
							{group.headers.map((header) => {
								const column = header.column;
								const sorted = column.getIsSorted();
								const title = column.columnDef.header;
								return (
									<TableHead
										key={header.id}
										scope="col"
										aria-sort={
											sorted === "asc"
												? "ascending"
												: sorted === "desc"
													? "descending"
													: undefined
										}
									>
										{header.isPlaceholder ? null : column.getCanSort() &&
											typeof title === "string" ? (
											<button
												type="button"
												onClick={column.getToggleSortingHandler()}
												className="-mx-1 inline-flex min-h-6 items-center gap-1 rounded-md px-1 font-medium hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring pointer-coarse:min-h-11"
											>
												{title}
												{sorted === "asc" ? (
													<ArrowUpIcon
														className="size-3.5"
														aria-hidden="true"
													/>
												) : sorted === "desc" ? (
													<ArrowDownIcon
														className="size-3.5"
														aria-hidden="true"
													/>
												) : (
													<ArrowUpDownIcon
														className="size-3.5 text-muted-foreground"
														aria-hidden="true"
													/>
												)}
												<span className="sr-only">
													{sorted === "asc"
														? t("sortedAscending")
														: sorted === "desc"
															? t(
																	"sortedDescending",
																)
															: t("sortable")}
												</span>
											</button>
										) : (
											<table.FlexRender header={header} />
										)}
									</TableHead>
								);
							})}
						</TableRow>
					))}
				</TableHeader>
				<TableBody>
					{rows.length === 0 ? (
						<TableRow>
							<TableCell colSpan={columns.length}>
								<Empty className="p-4">
									<EmptyIcon>
										<InboxIcon aria-hidden="true" />
									</EmptyIcon>
									<EmptyDescription>
										{total === 0
											? emptyLabel
											: t("noMatches")}
									</EmptyDescription>
								</Empty>
							</TableCell>
						</TableRow>
					) : (
						rows.map((row) => (
							<TableRow key={row.id}>
								{row.getAllCells().map((cell) => (
									<TableCell key={cell.id}>
										<table.FlexRender cell={cell} />
									</TableCell>
								))}
							</TableRow>
						))
					)}
				</TableBody>
			</Table>
		</div>
	);
}
