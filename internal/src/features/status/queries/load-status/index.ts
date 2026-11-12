import "server-only";

import type { StatusView } from "@/features/status/schemas/status-view";
import { getStatus } from "@/lib/api/client";

/** Read the status from the API and keep only what the interface shows. */
export async function loadStatus(): Promise<StatusView> {
	const status = await getStatus();
	return {
		version: status.version,
		domains: status.domains,
		accounts: status.accounts,
		queueSize: status.queue_size,
	};
}
