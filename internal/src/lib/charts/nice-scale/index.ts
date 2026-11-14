/** A count axis that starts at zero: its top, the distance between ticks and the ticks. */
export interface CountScale {
	/** The value at the top of the axis: the last tick, at or above the data. */
	readonly max: number;
	readonly step: number;
	/** From 0 to `max`, `step` apart. */
	readonly ticks: readonly number[];
}

/** Steps a reader can add in the head: 1, 2 and 5 times a power of ten. */
const ROUND_STEPS = [1, 2, 5, 10] as const;

/**
 * The axis of a chart of counts. It starts at 0, ends on the first round
 * number at or above `dataMax` and has at most `maxTicks` ticks above zero,
 * each a whole number (a count has no half), 1, 2 or 5 times a power of ten
 * apart. With nothing to show the axis still has a top, 1, so a scale never
 * divides by zero.
 */
export function niceCountScale(dataMax: number, maxTicks = 4): CountScale {
	const top =
		Number.isFinite(dataMax) && dataMax > 0 ? Math.ceil(dataMax) : 1;
	const wanted = Math.max(1, Math.floor(maxTicks));
	const rough = top / wanted;
	const power = 10 ** Math.floor(Math.log10(rough));
	const step = Math.max(
		1,
		(ROUND_STEPS.find((round) => round * power >= rough) ?? 10) * power,
	);
	const max = Math.ceil(top / step) * step;
	const ticks: number[] = [];
	for (let tick = 0; tick <= max; tick += step) {
		ticks.push(tick);
	}
	return { max, step, ticks };
}
