/** What the shares of one whole add up to: a thousand tenths of a percent. */
export const WHOLE_PER_MILLE = 1000;

/**
 * The share of each value in their sum, in tenths of a percent, as integers
 * that add up to exactly 1000. Plain rounding of each share can add up to
 * 99.9 % or 100.1 %; here every share is rounded down and the tenths left over
 * go to the values that lost the largest fraction, the earliest first on a tie.
 *
 * An empty list, or one whose values add up to nothing, has no shares: every
 * entry is 0. A value that is negative or not a finite number counts as 0.
 */
export function sharesPerMille(values: readonly number[]): number[] {
	const counts = values.map((value) =>
		Number.isFinite(value) && value > 0 ? value : 0,
	);
	const total = counts.reduce((sum, count) => sum + count, 0);
	if (total === 0) {
		return counts.map(() => 0);
	}
	const exact = counts.map((count) => (count * WHOLE_PER_MILLE) / total);
	const shares = exact.map(Math.floor);
	const left =
		WHOLE_PER_MILLE - shares.reduce((sum, share) => sum + share, 0);
	const byLostFraction = exact
		.map((value, index) => ({ index, lost: value - Math.floor(value) }))
		.sort((a, b) => b.lost - a.lost || a.index - b.index);
	for (const { index } of byLostFraction.slice(0, left)) {
		shares[index] = (shares[index] ?? 0) + 1;
	}
	return shares;
}
