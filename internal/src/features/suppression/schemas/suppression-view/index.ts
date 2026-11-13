/** One suppressed address, as a table row. */
export interface SuppressionRow {
	readonly address: string;
}

/** One page of the suppression list and the cursor of the next one, or `null` on the last. */
export interface SuppressionPageView {
	readonly entries: readonly SuppressionRow[];
	readonly nextCursor: string | null;
}
