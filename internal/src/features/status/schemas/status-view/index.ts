/** The status counters the interface shows; the API's field names are not kept. */
export interface StatusView {
	readonly version: string;
	readonly domains: number;
	readonly accounts: number;
	readonly queueSize: number;
}
