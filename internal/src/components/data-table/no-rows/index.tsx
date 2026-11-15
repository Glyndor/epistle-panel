import { useTranslations } from "next-intl";

import { EmptyState } from "@/components/empty-state";
import type { IllustrationName } from "@/components/illustration";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";

/** What a table says when it holds no row at all: the drawing, the sentence and the next step. */
export type DataTableEmpty = {
	illustration: IllustrationName;
	/** The one sentence that goes under the title: what to do about it. */
	description: string;
	/** A link or a button; none when there is nothing the person can do from here. */
	action?: React.ReactNode;
};

/**
 * The one row of a table with nothing to show. It says why: the list is empty
 * (the page's own title, sentence and next step), or the filters left no row,
 * and then it offers the way out, a button that takes every filter off.
 */
export function DataTableNoRows({
	colSpan,
	emptyLabel,
	empty,
	onClearFilters,
}: {
	colSpan: number;
	/** The title of a list with no rows at all. */
	emptyLabel: string;
	/** The rest of that state: drawing, sentence and action. */
	empty: DataTableEmpty;
	/** Takes the filters off; given only when it is the filters that left no row. */
	onClearFilters: (() => void) | undefined;
}) {
	const t = useTranslations("table");
	return (
		<TableRow>
			<TableCell colSpan={colSpan} className="p-0">
				{/*
				 * The table can be wider than the box that scrolls it, and the
				 * state is centred in the table: on a narrow screen it would sit
				 * out of sight. The block is as wide as the visible box (`cqw`
				 * of the table container) and stays at the left edge.
				 */}
				<div className="sticky left-0 w-[100cqw] max-w-full">
					{onClearFilters ? (
						<EmptyState
							role="status"
							className="p-4"
							illustration="search"
							title={t("noMatches")}
							description={t("noMatchesHint")}
							action={
								<Button
									variant="outline"
									onClick={onClearFilters}
								>
									{t("clearFilters")}
								</Button>
							}
						/>
					) : (
						<EmptyState
							className="p-4"
							illustration={empty.illustration}
							title={emptyLabel}
							description={empty.description}
							action={empty.action}
						/>
					)}
				</div>
			</TableCell>
		</TableRow>
	);
}
