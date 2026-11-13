import "server-only";

import type { SuppressionPageView } from "@/features/suppression/schemas/suppression-view";
import { getSuppression } from "@/lib/api/client";

/** Read one page of the global suppression list and keep only what the table shows. */
export async function loadSuppression(
	after?: string,
): Promise<SuppressionPageView> {
	const page = await getSuppression(
		after === undefined ? undefined : { after },
	);
	return {
		entries: page.addresses.map((address) => ({ address })),
		nextCursor: page.next_cursor ?? null,
	};
}
