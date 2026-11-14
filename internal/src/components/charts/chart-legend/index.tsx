import { cn } from "@/lib/class-names";

import type { SeriesIndex } from "../series";
import { Swatch } from "../swatch";

/** One entry of a {@link ChartLegend}. */
export interface LegendItem {
	readonly key: string;
	readonly label: string;
	/** The palette series the entry names; left out for the band of a column with missing data. */
	readonly series?: SeriesIndex;
}

/**
 * The names of the series of a chart, each beside its colour, in the order the
 * chart stacks them. A chart of two or more series always has one: nobody
 * should have to match colours to guess which is which. An entry with no
 * series is keyed with the tone of the band that fills a column with missing
 * data.
 */
export function ChartLegend({
	items,
	className,
}: {
	items: readonly LegendItem[];
	className?: string | undefined;
}) {
	return (
		<ul
			data-slot="chart-legend"
			className={cn(
				"flex flex-wrap gap-x-3 gap-y-1 text-muted-foreground text-xs",
				className,
			)}
		>
			{items.map((item) => (
				<li key={item.key} className="flex items-center gap-1.5">
					{item.series === undefined ? (
						<span
							aria-hidden="true"
							data-slot="chart-missing-key"
							className="size-3.5 shrink-0 rounded-sm bg-chart-missing forced-color-adjust-none"
						/>
					) : (
						<Swatch series={item.series} />
					)}
					{item.label}
				</li>
			))}
		</ul>
	);
}
