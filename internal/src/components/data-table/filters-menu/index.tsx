import { useTranslations } from "next-intl";
import {
	countFacets,
	type DataTableFiltersMenuProps,
} from "@/components/data-table/facets";
import { FilterMenu } from "@/components/filter-menu";

/**
 * The Filters button of a table and its menu: one group of tick boxes per
 * facet, and an action that unticks them all (it leaves the text filter
 * alone, which is why it is not named like the one that takes every filter
 * off). The button says how many are
 * ticked. Ticking leaves the menu open, so several can be set in one visit.
 * The list is rendered in the page's `main`, found when the menu opens, like
 * the menu of a table row: inside a landmark, never on `body`.
 *
 * A table that has facets imports this and gives it to `DataTable` as
 * `filtersMenu`. `DataTable` does not import it, so a table with no facets
 * does not carry the Radix menu, and it is not loaded apart either: a press on
 * the button while its code was still on the way was lost.
 */
export function DataTableFiltersMenu({
	facets,
	selection,
	onToggle,
	onClear,
}: DataTableFiltersMenuProps) {
	const t = useTranslations("table");
	const active = countFacets(selection);
	return (
		<FilterMenu
			label={t("filters")}
			activeLabel={t("filtersActive", { count: active })}
			clearLabel={t("deselectAll")}
			active={active}
			groups={facets.map((facet) => ({
				id: facet.columnId,
				label: facet.label,
				options: facet.options.map((option) => ({
					...option,
					checked:
						selection[facet.columnId]?.includes(option.value) ??
						false,
					onToggle: () => onToggle(facet.columnId, option.value),
				})),
			}))}
			onClear={onClear}
		/>
	);
}
