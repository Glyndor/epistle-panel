/**
 * One mail account, as a table row and as the source of its detail page.
 * `addresses` is also kept as one searchable string.
 */
export interface AccountRow {
	readonly name: string;
	/** The person's name, `null` when unset. */
	readonly displayName: string | null;
	readonly addresses: readonly string[];
	/** False for an account declared in the configuration file, which the API cannot change. */
	readonly dynamic: boolean;
}
