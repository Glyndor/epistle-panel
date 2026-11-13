/** One choice of a facet: the raw value of the column and the text shown for it. */
export interface DataTableFacetOption {
	readonly value: string;
	readonly label: string;
}

/**
 * A column the table can be narrowed by, in the Filters menu: the column's id,
 * the name of the group and the values it takes. Give one only for a column
 * whose values are a closed set the data really has.
 */
export interface DataTableFacet {
	/** Id of the column; its accessor returns one of the option values. */
	readonly columnId: string;
	readonly label: string;
	readonly options: readonly DataTableFacetOption[];
}

/** The options ticked in each facet, by column id. A facet with none is absent. */
export type FacetSelection = Readonly<Record<string, readonly string[]>>;

/**
 * What the table hands the Filters menu: the facets, what is ticked, and the
 * two changes it can ask for. Plain values, so the menu needs nothing of the
 * table itself.
 */
export interface DataTableFiltersMenuProps {
	facets: readonly DataTableFacet[];
	selection: FacetSelection;
	onToggle: (columnId: string, value: string) => void;
	onClear: () => void;
}

/** Nothing ticked. */
export const NO_FACETS: FacetSelection = {};

/** The selection with `value` ticked in `columnId` when it was not, and unticked when it was. */
export function toggleFacet(
	selection: FacetSelection,
	columnId: string,
	value: string,
): FacetSelection {
	const ticked = selection[columnId] ?? [];
	const next = ticked.includes(value)
		? ticked.filter((other) => other !== value)
		: [...ticked, value];
	const { [columnId]: _dropped, ...rest } = selection;
	return next.length === 0 ? rest : { ...rest, [columnId]: next };
}

/** How many options are ticked, over every facet: the number on the Filters button. */
export function countFacets(selection: FacetSelection): number {
	return Object.values(selection).reduce(
		(sum, ticked) => sum + ticked.length,
		0,
	);
}

/** The selection as the column filters the table takes. */
export function toColumnFilters(
	selection: FacetSelection,
): { id: string; value: readonly string[] }[] {
	return Object.entries(selection).map(([id, value]) => ({ id, value }));
}
