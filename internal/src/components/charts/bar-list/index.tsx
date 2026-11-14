import type * as React from "react";

import { cn } from "@/lib/class-names";

import { Mark } from "../mark";
import { percent, SERIES } from "../series";

/** Height of a bar, in pixels. The row that holds it is `h-2`. */
const BAR_HEIGHT = 8;

/** Shortest a bar with a value is drawn, in percent of the longest. */
const MIN_BAR_WIDTH = 1;

/** One row of a {@link BarList}. */
export interface BarListRow {
	readonly key: string;
	readonly label: React.ReactNode;
	/** The number the bar is as long as. */
	readonly value: number;
	/** The same number, written for the reader. */
	readonly valueText: string;
	/** A second figure beside it, such as the share. */
	readonly detail?: string;
	/** Draw the bar in the quiet grey: a row that gathers the rest, or the unknown. */
	readonly quiet?: boolean;
}

/**
 * One series as horizontal bars, a row each: the name and its figure on one
 * line and the bar under them, so a long name is cut with an ellipsis and
 * never squeezes the bar, and the list reads the same on a phone. Every bar
 * starts at the same edge and the longest spans the row; a value of nothing
 * has a row and no bar. All the bars are one colour, because the rows are one
 * series: the name says which.
 *
 * A bar is a {@link Mark} as wide as a percentage of the row, drawn on the
 * server.
 */
export function BarList({
	rows,
	className,
}: {
	rows: readonly BarListRow[];
	className?: string | undefined;
}) {
	const longest = Math.max(0, ...rows.map((row) => row.value));
	return (
		<div
			data-slot="bar-list"
			className={cn("flex min-w-0 flex-col gap-2.5", className)}
		>
			{rows.map((row) => (
				<div
					key={row.key}
					data-row={row.key}
					className="flex flex-col gap-1"
				>
					<div className="flex items-baseline justify-between gap-3 text-sm">
						<span className="min-w-0 truncate">{row.label}</span>
						<span className="shrink-0 tabular-nums">
							{row.valueText}
							{row.detail ? (
								<span className="ms-2 text-muted-foreground">
									{row.detail}
								</span>
							) : null}
						</span>
					</div>
					<div className="h-2">
						{row.value > 0 && longest > 0 ? (
							<Mark
								width={percent(
									Math.max(
										(row.value / longest) * 100,
										MIN_BAR_WIDTH,
									),
								)}
								height={BAR_HEIGHT}
								className={cn(
									"rounded-full",
									row.quiet
										? "bg-muted-foreground"
										: SERIES[0],
								)}
							/>
						) : null}
					</div>
				</div>
			))}
		</div>
	);
}
