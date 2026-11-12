import "server-only";

import { queueEntryIdSchema } from "@/features/queue/schemas/queue-input";
import type { QueuePageView } from "@/features/queue/schemas/queue-view";
import { getQueue } from "@/lib/api/client";

/** Read one page of the queue from the API and keep only what the table shows. */
export async function loadQueue(cursor?: string): Promise<QueuePageView> {
	const page = await getQueue(cursor === undefined ? undefined : { cursor });
	return {
		entries: page.entries.map((entry) => ({
			id: queueEntryIdSchema.parse(entry.id),
			from: entry.reverse_path || "<>",
			recipients: entry.recipients,
		})),
		nextCursor: page.next_cursor ?? null,
	};
}
