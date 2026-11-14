/** Where one part of a segmented bar starts and how wide it is, in percent of the bar. */
export interface Segment {
	readonly start: number;
	readonly width: number;
}

/**
 * Lay the parts of one whole side by side, in the order given, as percentages
 * of the bar's width that add up to 100. A part with nothing draws nothing
 * (width 0). A part with something is never narrower than `minWidth` percent,
 * so one record among thousands is still a visible sliver: what it gains is
 * taken from the parts above the minimum, in proportion to their room.
 *
 * With no value above zero there is no bar, and every width is 0.
 */
export function layoutSegments(
	values: readonly number[],
	minWidth = 0,
): Segment[] {
	const counts = values.map((value) =>
		Number.isFinite(value) && value > 0 ? value : 0,
	);
	const total = counts.reduce((sum, count) => sum + count, 0);
	if (total === 0) {
		return counts.map(() => ({ start: 0, width: 0 }));
	}
	const drawn = counts.filter((count) => count > 0).length;
	// A minimum the parts cannot all have is cut to what the bar can give.
	const floor = Math.min(Math.max(minWidth, 0), 100 / drawn);
	const natural = counts.map((count) => (count * 100) / total);
	const short = natural.reduce(
		(sum, width) => sum + (width > 0 && width < floor ? floor - width : 0),
		0,
	);
	const room = natural.reduce(
		(sum, width) => sum + (width > floor ? width - floor : 0),
		0,
	);
	let start = 0;
	return natural.map((width) => {
		let final = width;
		if (width > 0 && width < floor) {
			final = floor;
		} else if (width > floor && room > 0) {
			final = width - (short * (width - floor)) / room;
		}
		const segment = { start, width: final };
		start += final;
		return segment;
	});
}
