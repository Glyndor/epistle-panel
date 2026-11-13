import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { TableHead, TableHeader, TableRow } from "@/components/ui/table";

/**
 * One header cell as plain values. The table's owner reads them from the
 * table in its own render; a cell that read them here, through the column
 * object, would be memoised against that stable object and show a stale order.
 */
export interface HeaderCell {
	readonly id: string;
	/** The order the column is in, or `false`. */
	readonly sorted: false | "asc" | "desc";
	/** The column's title when it can be sorted by; `undefined` when it cannot. */
	readonly sortTitle: string | undefined;
	/** Changes the order of the column. */
	readonly onToggleSort: ((event: unknown) => void) | undefined;
	/** What an unsortable cell shows. */
	readonly content: React.ReactNode;
	/** The column's own classes, the same its body cells get. */
	readonly className?: string | undefined;
}

/**
 * Bring a sort button the keyboard has reached into the table's scroll box. A
 * wide table scrolls sideways, and the browser's own scroll left a header that
 * was tabbed to almost outside it (the delivery log at 360 px). Only for the
 * keyboard: moving the button under a pointer in the middle of a click would
 * lose the click.
 */
function revealWhenTabbedTo(event: React.FocusEvent<HTMLButtonElement>) {
	if (event.currentTarget.matches(":focus-visible")) {
		event.currentTarget.scrollIntoView({
			block: "nearest",
			inline: "nearest",
		});
	}
}

/** The header row of a panel table: a sort button on each sortable column, with its order said in words. */
export function DataTableHeader({
	rows,
}: {
	rows: readonly { id: string; cells: readonly HeaderCell[] }[];
}) {
	const t = useTranslations("table");
	return (
		<TableHeader>
			{rows.map((row) => (
				<TableRow key={row.id}>
					{row.cells.map((cell) => (
						<TableHead
							key={cell.id}
							scope="col"
							className={cell.className}
							aria-sort={
								cell.sorted === "asc"
									? "ascending"
									: cell.sorted === "desc"
										? "descending"
										: undefined
							}
						>
							{cell.sortTitle === undefined ? (
								cell.content
							) : (
								<Button
									variant="ghost"
									size="sm"
									onClick={cell.onToggleSort}
									onFocus={revealWhenTabbedTo}
									className="-mx-2 scroll-mx-2 gap-1 font-medium text-sm pointer-coarse:-mx-3"
								>
									{cell.sortTitle}
									{cell.sorted === "asc" ? (
										<ArrowUpIcon
											className="size-3.5"
											aria-hidden="true"
										/>
									) : cell.sorted === "desc" ? (
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
										{cell.sorted === "asc"
											? t("sortedAscending")
											: cell.sorted === "desc"
												? t("sortedDescending")
												: t("sortable")}
									</span>
								</Button>
							)}
						</TableHead>
					))}
				</TableRow>
			))}
		</TableHeader>
	);
}
