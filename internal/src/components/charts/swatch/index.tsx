import { cn } from "@/lib/class-names";

import { SERIES, type SeriesIndex } from "../series";

/**
 * The colour key of one series, beside the label that names it. The square
 * sits on a small tile of the card's own surface: a legend row can be striped
 * or tinted under the pointer, and the tile keeps the colour against the
 * surface it was measured on.
 */
export function Swatch({
	series,
	className,
}: {
	series: SeriesIndex;
	className?: string | undefined;
}) {
	return (
		<span
			data-slot="chart-swatch"
			aria-hidden="true"
			className={cn(
				"inline-flex shrink-0 rounded-sm bg-card p-0.5",
				className,
			)}
		>
			<span
				className={cn(
					"size-2.5 rounded-xs forced-color-adjust-none",
					SERIES[series],
				)}
			/>
		</span>
	);
}
