import { queryOptions } from "@tanstack/react-query";

import type { DeliveryFilters } from "@/features/deliveries/schemas/deliveries-input";
import type { DeliveriesView } from "@/features/deliveries/schemas/deliveries-view";

/** Query keys of the deliveries feature. The filters are part of the key, in a fixed order. */
export const deliveriesKeys = {
	all: ["deliveries"] as const,
	list: (filters: DeliveryFilters) =>
		[
			"deliveries",
			"list",
			filters.outcome ?? null,
			filters.since ?? null,
			filters.recipient ?? null,
		] as const,
};

/** How often the log refreshes while the tab is in view, in milliseconds. */
export const DELIVERIES_REFRESH_MS = 30_000;

/**
 * Options of the delivery log for one set of filters, shared by the server
 * prefetch and the browser. Polls only while the tab is in view.
 */
export function deliveriesQueryOptions(
	filters: DeliveryFilters,
	fetcher: (filters: DeliveryFilters) => Promise<DeliveriesView>,
) {
	return queryOptions({
		queryKey: deliveriesKeys.list(filters),
		queryFn: () => fetcher(filters),
		refetchInterval: DELIVERIES_REFRESH_MS,
		refetchIntervalInBackground: false,
	});
}
