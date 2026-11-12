"use server";

import { loadQueue } from "@/features/queue/queries/load-queue";
import { queuePageInputSchema } from "@/features/queue/schemas/queue-input";
import type { QueuePageView } from "@/features/queue/schemas/queue-view";
import type { ActionResult } from "@/lib/query/action-result";
import { runValidatedAction } from "@/lib/query/run-action";

/**
 * Server Action behind the queue query. The input is validated with the schema
 * the client builds its request from: anything but an optional UUID cursor is
 * refused before the API is called.
 */
export async function getQueuePageAction(
	input: unknown,
): Promise<ActionResult<QueuePageView>> {
	return runValidatedAction(
		"queue fetch",
		queuePageInputSchema,
		input,
		(data) => loadQueue(data.cursor),
	);
}
