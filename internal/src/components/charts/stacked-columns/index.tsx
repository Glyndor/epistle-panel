import { axisLabels } from "@/lib/charts/axis-ticks";
import { niceCountScale } from "@/lib/charts/nice-scale";
import { columnWidth, stackColumn } from "@/lib/charts/stack";
import { cn } from "@/lib/class-names";

import { Mark } from "../mark";
import { SERIES, type SeriesIndex } from "../series";

/** Height of the plot, in pixels: the tallest column the scale allows. The plot's class is `h-40`. */
const PLOT_HEIGHT = 160;

/**
 * How far over its own total the scale reaches for a column whose data is not
 * all there. What it holds is the least it can be, so the plot keeps room over
 * it, and the band that says so is always drawn.
 */
const SHADED_HEADROOM = 1.1;

/** How the label of a column lines up with it. */
const ANCHOR = {
	start: "left-0",
	middle: "left-1/2 -translate-x-1/2",
	end: "right-0",
} as const;

/** One column of a {@link StackedColumns} chart. */
export interface StackedColumn {
	readonly key: string;
	/** One value per series, in the order of `series`; stacked from the baseline up. */
	readonly values: readonly number[];
	/** What the browser shows when the pointer rests on the column: its label and its figures. */
	readonly hint: string;
	/** Fill what the column leaves of its slot with the band of missing data, for one whose data is not all there. */
	readonly shaded?: boolean;
	/** The label under the column; most columns have none. */
	readonly label?: string;
}

/**
 * Columns over time, each a stack of the same series in the same order, on a
 * count axis that starts at zero. The numbers of the axis are at the left and
 * the labels of some columns below. The levels of the axis are bands of two
 * tones, the lowest always the deeper one so the columns stand on its edge:
 * the panel draws no line, and a plot is no exception.
 *
 * A column whose data is not all there has the rest of its slot, over what it
 * does hold, filled with the band of missing data (`--chart-missing`). The
 * band is 3:1 against the card and against both tones of the levels, so it is
 * seen without the legend; it is never behind a part, which would take that
 * part's own contrast away.
 *
 * It is drawn on the server. The columns share the plot's width as equal flex
 * slots, and each part of a column is a {@link Mark} whose height in pixels is
 * its value on the scale: the chart follows its card at any width with no
 * script and no inline style, and its words are text of the page, which a
 * reader can enlarge. The parts of a column are told apart by a gap of the
 * card's surface, not by a line.
 */
export function StackedColumns({
	columns,
	series,
	formatTick,
	className,
}: {
	columns: readonly StackedColumn[];
	/** The palette series of each value of a column. */
	series: readonly SeriesIndex[];
	/** Write a number of the count axis in the reader's locale. */
	formatTick: (value: number) => string;
	className?: string | undefined;
}) {
	const peak = Math.max(
		0,
		...columns.map((column) => {
			const total = column.values.reduce((sum, value) => sum + value, 0);
			return column.shaded ? Math.ceil(total * SHADED_HEADROOM) : total;
		}),
	);
	const scale = niceCountScale(peak);
	const width = columnWidth(columns.length);
	const anchors = new Map(
		axisLabels(
			columns.length,
			(index) => columns[index]?.label !== undefined,
		).map((label) => [label.index, label.anchor]),
	);
	return (
		<div
			data-slot="stacked-columns"
			className={cn("flex min-w-0 gap-2", className)}
		>
			<div
				data-slot="chart-axis"
				className="flex h-40 shrink-0 flex-col-reverse justify-between text-end text-muted-foreground text-xs tabular-nums"
			>
				{scale.ticks.map((tick) => (
					<span
						key={tick}
						className="flex h-0 items-center justify-end"
					>
						{formatTick(tick)}
					</span>
				))}
			</div>
			<div className="min-w-0 flex-1">
				<div className="relative h-40">
					<div
						data-slot="chart-levels"
						className="absolute inset-0 flex flex-col-reverse overflow-hidden rounded-md"
					>
						{scale.ticks.slice(1).map((tick, index) => (
							<div
								key={tick}
								className={cn(
									"flex-1",
									index % 2 === 0 && "bg-surface-sunken",
								)}
							/>
						))}
					</div>
					<div className="relative flex h-full">
						{columns.map((column) => {
							const stack = stackColumn(
								column.values,
								scale.max,
								PLOT_HEIGHT,
							);
							return (
								<div
									key={column.key}
									data-column={column.key}
									data-shaded={
										column.shaded ? "true" : undefined
									}
									title={column.hint}
									className="flex min-w-0 flex-1 flex-col-reverse gap-0.5"
								>
									{stack.height > 0 ? (
										<div
											data-slot="chart-stack"
											className={cn(
												"flex flex-col-reverse items-center",
												stack.gap > 0 && "gap-0.5",
											)}
										>
											{stack.parts.map((part, index) => {
												const palette = series[index];
												if (
													part === null ||
													palette === undefined
												) {
													return null;
												}
												return (
													<Mark
														// biome-ignore lint/suspicious/noArrayIndexKey: the series of a column never reorder.
														key={index}
														data-series={palette}
														width={width}
														height={Number(
															part.height.toFixed(
																2,
															),
														)}
														className={cn(
															"rounded-xs",
															SERIES[palette],
														)}
													/>
												);
											})}
										</div>
									) : null}
									{column.shaded ? (
										<div
											data-slot="chart-missing"
											className="flex-1 bg-chart-missing forced-color-adjust-none"
										/>
									) : null}
								</div>
							);
						})}
					</div>
				</div>
				<div className="flex h-5 text-muted-foreground text-xs">
					{columns.map((column, index) => (
						<div
							key={column.key}
							className="relative min-w-0 flex-1"
						>
							{column.label === undefined ? null : (
								<span
									data-slot="chart-tick"
									className={cn(
										"absolute top-1 whitespace-nowrap",
										ANCHOR[anchors.get(index) ?? "middle"],
									)}
								>
									{column.label}
								</span>
							)}
						</div>
					))}
				</div>
			</div>
		</div>
	);
}
