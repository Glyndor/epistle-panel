import { layoutSegments } from "@/lib/charts/segments";
import { cn } from "@/lib/class-names";

import { Mark } from "../mark";
import { percent, SERIES, type SeriesIndex } from "../series";

/** Narrowest a part with a value is drawn, in percent of the bar: a few pixels on a phone. */
const MIN_PART_WIDTH = 2;

/** Height of the bar, in pixels. The bar's class is `h-3`. */
const BAR_HEIGHT = 12;

/** One part of a {@link SegmentedBar}. */
export interface SegmentedBarPart {
	/** Stable key of the part. */
	readonly key: string;
	readonly value: number;
	readonly series: SeriesIndex;
}

/**
 * One whole split into its parts, as a thin bar: each part is as wide as its
 * share and a part with nothing draws nothing. It carries no text; the list or
 * table beside it gives each part's name and figure, with the same colour as
 * its key.
 *
 * Each part is a {@link Mark} whose width is a percentage of the bar, so the
 * page needs no script and no inline style to draw it. The parts are told
 * apart by a gap of the card's surface, not by a line.
 */
export function SegmentedBar({
	parts,
	className,
}: {
	parts: readonly SegmentedBarPart[];
	className?: string | undefined;
}) {
	const layout = layoutSegments(
		parts.map((part) => part.value),
		MIN_PART_WIDTH,
	);
	return (
		<div
			data-slot="segmented-bar"
			className={cn(
				"flex h-3 gap-0.5 overflow-hidden rounded-full",
				className,
			)}
		>
			{parts.map((part, index) => {
				const segment = layout[index];
				if (segment === undefined || segment.width === 0) {
					return null;
				}
				return (
					<Mark
						key={part.key}
						data-part={part.key}
						width={percent(segment.width)}
						height={BAR_HEIGHT}
						// The widths add up to the whole bar; the gaps come out of
						// each part in proportion, which is what shrinking does.
						className={cn("min-w-0 shrink", SERIES[part.series])}
					/>
				);
			})}
		</div>
	);
}
