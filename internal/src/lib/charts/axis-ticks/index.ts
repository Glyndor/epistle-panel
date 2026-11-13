/** A label under the plot: the column it names, where it sits and which way its text runs from there. */
export interface AxisLabel {
	/** Index of the column the label belongs to. */
	readonly index: number;
	/** Centre of that column, in percent of the plot's width. */
	readonly x: number;
	/** `start` near the left edge and `end` near the right, so a label never leaves the plot. */
	readonly anchor: "start" | "middle" | "end";
}

/** Share of the width, at each side, where a centred label could be cut by the edge. */
const EDGE = 12;

/**
 * Pick the columns that get a label under the plot: the ones `wanted` says,
 * placed at the centre of their slot. A label close to an edge runs inward
 * from its column instead of being centred on it, so its text stays inside the
 * plot at any width.
 */
export function axisLabels(
	count: number,
	wanted: (index: number) => boolean,
): AxisLabel[] {
	const labels: AxisLabel[] = [];
	for (let index = 0; index < count; index += 1) {
		if (!wanted(index)) {
			continue;
		}
		const x = ((index + 0.5) * 100) / count;
		labels.push({
			index,
			x,
			anchor: x < EDGE ? "start" : x > 100 - EDGE ? "end" : "middle",
		});
	}
	return labels;
}
