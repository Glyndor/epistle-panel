import "server-only";

import { cache } from "react";

import { loadDeliveries } from "@/features/deliveries/queries/load-deliveries";
import { bucketDeliveries } from "@/features/overview/queries/bucket-deliveries";
import { countOutcomes } from "@/features/overview/queries/count-outcomes";
import type { OverviewPeriod } from "@/features/overview/schemas/overview-input";
import type { DeliveryOverview } from "@/features/overview/schemas/overview-view";
import { logApiFailure } from "@/lib/api/log-failure";

/**
 * Read the delivery records of a period and count them for the overview's two
 * delivery charts. It is one call to the API, for the 100 records it gives at
 * most. A failure is logged under a fixed name and answered as `unreachable`,
 * so a chart shows a notice and the rest of the page still renders.
 */
export async function loadDeliveryOverview(
	period: OverviewPeriod,
): Promise<DeliveryOverview> {
	try {
		const view = await loadDeliveries({ since: period });
		if (view.logDisabled) {
			return { kind: "disabled" };
		}
		const readAt = Math.floor(Date.now() / 1000);
		return {
			kind: "data",
			period,
			readAt,
			full: view.full,
			outcomes: countOutcomes(view.entries),
			timeline: bucketDeliveries(view.entries, period, readAt, view.full),
		};
	} catch (error) {
		logApiFailure("overview deliveries", error);
		return { kind: "unreachable" };
	}
}

/**
 * The delivery overview of the request: the two charts that draw it ask for it
 * each in its own `Suspense`, and the API is asked once.
 */
export const requestDeliveryOverview: (
	period: OverviewPeriod,
) => Promise<DeliveryOverview> = cache(loadDeliveryOverview);
