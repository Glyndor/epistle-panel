import { layoutSegments } from "@/lib/charts/segments";

/** One drawn part of a stacked column: its top edge and its height, in pixels of the plot. */
export interface StackPart {
	readonly y: number;
	readonly height: number;
}

/** One column, stacked: how high it is, the gap between its parts and the parts. */
export interface ColumnStack {
	/** From the baseline to the top of the highest part: the column's total on the scale. */
	readonly height: number;
	/** Pixels of the plot's own surface between two parts: {@link PART_GAP}, or 0 in a column too low to afford it. */
	readonly gap: number;
	/** One entry per value, in the order given; `null` for a value of nothing. */
	readonly parts: readonly (StackPart | null)[];
}

/** Height a part with a value is drawn at when its column has the room, in pixels. */
export const MIN_PART_HEIGHT = 3;

/** The gap of the plot's own surface between two parts of a column, in pixels. */
export const PART_GAP = 2;

/** Height a column with a value is never drawn under, in pixels: less would not be seen at all. */
export const MIN_COLUMN_HEIGHT = 1;

/**
 * Stack the values of one column from the baseline up, in the order given.
 * `scaleMax` is the value at the top of a plot `plotHeight` pixels high; `y`
 * is measured from the top of the plot, the way SVG counts.
 *
 * The height of the column is its total on the scale and nothing else: the
 * gaps between its parts and the minimum height of a small part are taken out
 * of its larger parts, never added on top. So two columns compare as their
 * totals do, a column of more is never the lower one, and none passes the top
 * of the plot. The one exception is a pixel: a column with a value is at least
 * {@link MIN_COLUMN_HEIGHT} high, since a column of a third of a pixel would
 * read as nothing.
 *
 * Inside the column, a part with a value is {@link MIN_PART_HEIGHT} pixels or
 * more and two parts are {@link PART_GAP} pixels apart, as long as the column
 * is high enough for both. A column too low for both has no gap, and one too
 * low for the minimum alone shares what it has evenly. A value of nothing
 * draws nothing (`null`).
 */
export function stackColumn(
	values: readonly number[],
	scaleMax: number,
	plotHeight: number,
): ColumnStack {
	const counts = values.map((value) =>
		Number.isFinite(value) && value > 0 ? value : 0,
	);
	const total = counts.reduce((sum, count) => sum + count, 0);
	const drawn = counts.filter((count) => count > 0).length;
	if (total === 0 || !(scaleMax > 0) || !(plotHeight > 0)) {
		return { height: 0, gap: 0, parts: counts.map(() => null) };
	}
	const height = Math.min(
		Math.max((total * plotHeight) / scaleMax, MIN_COLUMN_HEIGHT),
		plotHeight,
	);
	// A column too low for the minimum and the gaps gives up the gaps first.
	const gaps = drawn - 1;
	const gap =
		height - PART_GAP * gaps >= drawn * MIN_PART_HEIGHT ? PART_GAP : 0;
	const room = height - gap * gaps;
	const shares = layoutSegments(counts, (MIN_PART_HEIGHT / room) * 100);
	let top = plotHeight;
	let below = false;
	const parts = shares.map((share) => {
		if (share.width === 0) {
			return null;
		}
		const partHeight = (share.width * room) / 100;
		top -= partHeight + (below ? gap : 0);
		below = true;
		return { y: top, height: partHeight };
	});
	return { height, gap, parts };
}

/** Thickest a column is drawn, in pixels. */
export const MAX_COLUMN_WIDTH = 24;

/** Most columns that are drawn at the fixed width: more would not fit a narrow card. */
export const FIXED_WIDTH_UP_TO = 10;

/** The share of its slot a column fills when it is not drawn at the fixed width, in percent. */
export const FLUID_FILL = 60;

/**
 * How wide a column is drawn in a chart of `count` columns that share the
 * plot's width as equal slots: pixels as a number, or a percentage of the slot
 * as a string. A chart of few columns draws them {@link MAX_COLUMN_WIDTH}
 * pixels wide, because a share of a wide slot would be a slab; a chart of many
 * draws each as a share of its slot, which is thin on a phone and stays under
 * the cap on a wide screen.
 */
export function columnWidth(count: number): number | string {
	return count <= FIXED_WIDTH_UP_TO ? MAX_COLUMN_WIDTH : `${FLUID_FILL}%`;
}
