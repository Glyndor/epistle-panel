"use server";

import { loadDeliveries } from "@/features/deliveries/queries/load-deliveries";
import { deliveryFiltersSchema } from "@/features/deliveries/schemas/deliveries-input";
import type { DeliveriesView } from "@/features/deliveries/schemas/deliveries-view";
import type { ActionResult } from "@/lib/query/action-result";
import { runValidatedAction } from "@/lib/query/run-action";

/**
 * Server Action behind the deliveries query. The filters are validated with the
 * schema the client builds its request from: an unknown outcome or window, a
 * recipient that is not an address and any extra field are refused before the
 * API is called.
 */
export async function getDeliveriesAction(
	input: unknown,
): Promise<ActionResult<DeliveriesView>> {
	return runValidatedAction(
		"deliveries fetch",
		deliveryFiltersSchema,
		input,
		(filters) => loadDeliveries(filters),
	);
}
