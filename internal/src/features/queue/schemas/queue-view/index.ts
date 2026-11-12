import type { QueueEntryId } from "@/features/queue/schemas/queue-input";

/** One queued message, as a table row. An empty sender is shown as `<>`. */
export interface QueueRow {
	readonly id: QueueEntryId;
	readonly from: string;
	readonly recipients: readonly string[];
}

/** One page of the queue and the cursor of the next one, or `null` on the last. */
export interface QueuePageView {
	readonly entries: readonly QueueRow[];
	readonly nextCursor: string | null;
}
