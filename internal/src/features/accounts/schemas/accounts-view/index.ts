/** One mail account, as a table row. `addresses` is also kept as one searchable string. */
export interface AccountRow {
	readonly name: string;
	readonly addresses: readonly string[];
}
