import type { DeliveryOutcome } from "@/lib/api/schemas";

/** One delivery record, as a table row. */
export interface DeliveryRow {
	/** Unique within the page: the same message can have several records. */
	readonly id: string;
	/** Epoch seconds. */
	readonly time: number;
	readonly outcome: DeliveryOutcome;
	readonly recipient: string;
	/** The envelope sender; empty for a bounce. */
	readonly from: string;
	/** The local account that submitted it; `null` for relayed mail. */
	readonly account: string | null;
	readonly remote: string | null;
	readonly reply: string | null;
	readonly attempt: number;
}

/** The records of one request, newest first, and whether the log is switched off. */
export interface DeliveriesView {
	readonly entries: readonly DeliveryRow[];
	/** The API answered 404: `[storage] delivery_log_days` is 0. */
	readonly logDisabled: boolean;
	/** The page came back full, so older records may exist that it did not return. */
	readonly full: boolean;
}
