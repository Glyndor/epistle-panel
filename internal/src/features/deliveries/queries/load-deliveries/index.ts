import "server-only";

import {
	DELIVERIES_LIMIT,
	type DeliveryFilters,
} from "@/features/deliveries/schemas/deliveries-input";
import type { DeliveriesView } from "@/features/deliveries/schemas/deliveries-view";
import { EpistleApiError, getDeliveries } from "@/lib/api/client";

/**
 * Read the delivery log through the API and keep what the table shows, newest
 * first. The API orders by day and, inside a day, oldest first, so the page is
 * sorted here. A 404 means the log is switched off on the server, which is a
 * state to show, not a failure.
 */
export async function loadDeliveries(
	filters: DeliveryFilters,
): Promise<DeliveriesView> {
	let page: Awaited<ReturnType<typeof getDeliveries>>;
	try {
		page = await getDeliveries({ ...filters, limit: DELIVERIES_LIMIT });
	} catch (error) {
		if (error instanceof EpistleApiError && error.status === 404) {
			return { entries: [], logDisabled: true, full: false };
		}
		throw error;
	}
	const entries = page.entries
		.map((entry, index) => ({
			id: `${index}:${entry.spool_id}`,
			time: entry.time,
			outcome: entry.outcome,
			recipient: entry.recipient,
			from: entry.from,
			account: entry.account,
			remote: entry.remote,
			reply: entry.reply,
			attempt: entry.attempt,
		}))
		.sort((a, b) => b.time - a.time);
	return {
		entries,
		logDisabled: false,
		full: page.entries.length >= DELIVERIES_LIMIT,
	};
}
