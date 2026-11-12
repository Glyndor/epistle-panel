"use server";

import { loadStatus } from "@/features/status/queries/load-status";
import type { StatusView } from "@/features/status/schemas/status-view";
import type { ActionResult } from "@/lib/query/action-result";
import { runAction } from "@/lib/query/run-action";

/**
 * Server Action behind the status query: the counters for a signed-in admin.
 * The client reaches the API only through this; the token stays on the server.
 */
export async function getStatusAction(): Promise<ActionResult<StatusView>> {
	return runAction("status fetch", loadStatus);
}
