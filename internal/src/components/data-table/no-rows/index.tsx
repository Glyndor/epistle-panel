import { InboxIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyIcon } from "@/components/ui/empty";
import { TableCell, TableRow } from "@/components/ui/table";

/**
 * The one row of a table with nothing to show. It says why: the list is empty
 * (the page's own sentence), or the filters left no row, and then it offers
 * the way out, a button that takes every filter off.
 */
export function DataTableNoRows({
	colSpan,
	emptyLabel,
	onClearFilters,
}: {
	colSpan: number;
	/** The sentence of a list with no rows at all. */
	emptyLabel: string;
	/** Takes the filters off; given only when it is the filters that left no row. */
	onClearFilters: (() => void) | undefined;
}) {
	const t = useTranslations("table");
	return (
		<TableRow>
			<TableCell colSpan={colSpan}>
				<Empty className="p-4">
					<EmptyIcon>
						<InboxIcon aria-hidden="true" />
					</EmptyIcon>
					<EmptyDescription>
						{onClearFilters ? t("noMatches") : emptyLabel}
					</EmptyDescription>
					{onClearFilters ? (
						<Button variant="outline" onClick={onClearFilters}>
							{t("clearFilters")}
						</Button>
					) : null}
				</Empty>
			</TableCell>
		</TableRow>
	);
}
