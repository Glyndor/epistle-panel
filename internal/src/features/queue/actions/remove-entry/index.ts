"use server";

import {
	type QueueEntryId,
	removeEntryInputSchema,
} from "@/features/queue/schemas/queue-input";
import { removeQueueEntry } from "@/lib/api/client";
import type { ActionResult } from "@/lib/query/action-result";
import { runValidatedAction } from "@/lib/query/run-action";

/**
 * Server Action: drop one entry from the outbound spool. Irreversible, so the
 * id has to be a UUID and nothing else is accepted. The session is checked
 * here as well as in the proxy: a Server Action is a public POST endpoint.
 */
export async function removeEntryAction(
	input: unknown,
): Promise<ActionResult<{ readonly removed: QueueEntryId }>> {
	return runValidatedAction(
		"queue remove",
		removeEntryInputSchema,
		input,
		async (data) => {
			await removeQueueEntry(data.id);
			return { removed: data.id };
		},
	);
}
