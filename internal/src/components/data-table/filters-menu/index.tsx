import { ListFilterIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";

import {
	countFacets,
	type DataTableFiltersMenuProps,
} from "@/components/data-table/facets";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
	const id = useId();
	const [main, setMain] = useState<HTMLElement | null>(null);
	const active = countFacets(selection);

	return (
		<DropdownMenu
			onOpenChange={(open) => {
				if (open) {
					setMain(document.getElementById("main-content"));
				}
			}}
		>
			<DropdownMenuTrigger asChild>
				<Button variant="outline">
					<ListFilterIcon aria-hidden="true" />
					{t("filters")}
					{active > 0 ? (
						<>
							<Badge variant="default" aria-hidden="true">
								{active}
							</Badge>
							<span className="sr-only">
								{t("filtersActive", { count: active })}
							</span>
						</>
					) : null}
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" container={main}>
				{facets.map((facet) => (
					<DropdownMenuGroup
						key={facet.columnId}
						aria-labelledby={`${id}-${facet.columnId}`}
					>
						<DropdownMenuLabel id={`${id}-${facet.columnId}`}>
							{facet.label}
						</DropdownMenuLabel>
						{facet.options.map((option) => (
							<DropdownMenuCheckboxItem
								key={option.value}
								checked={
									selection[facet.columnId]?.includes(
										option.value,
									) ?? false
								}
								onCheckedChange={() =>
									onToggle(facet.columnId, option.value)
								}
								onSelect={(event) => event.preventDefault()}
							>
								{option.label}
							</DropdownMenuCheckboxItem>
						))}
					</DropdownMenuGroup>
				))}
				<DropdownMenuSeparator />
				<DropdownMenuItem disabled={active === 0} onSelect={onClear}>
					{t("deselectAll")}
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
