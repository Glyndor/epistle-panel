/** One configured domain, as a table row. */
export interface DomainRow {
	readonly name: string;
	/** True for a domain that is switched off and takes no mail. */
	readonly disabled: boolean;
}
