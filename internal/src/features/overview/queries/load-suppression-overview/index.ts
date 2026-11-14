import "server-only";

import { cache } from "react";

import { topDomains } from "@/features/overview/queries/top-domains";
import type { SuppressionOverview } from "@/features/overview/schemas/overview-view";
import { getSuppression } from "@/lib/api/client";
import { logApiFailure } from "@/lib/api/log-failure";

/** Addresses asked for in one call: the most the API gives. */
const PAGE_SIZE = 100;

/** Most calls one overview makes for the list, so a long list cannot hold the page. */
const MAX_PAGES = 5;

/**
 * Read the global suppression list for the overview, in the API's alphabetical
 * order, following its cursor for at most {@link MAX_PAGES} pages of
 * {@link PAGE_SIZE}. A longer list is `capped`. A failure is logged under a
 * fixed name and answered as `unreachable`.
 */
export async function loadSuppressionOverview(): Promise<SuppressionOverview> {
	try {
		const addresses: string[] = [];
		let after: string | undefined;
		for (let page = 0; page < MAX_PAGES; page += 1) {
			const answer = await getSuppression(
				after === undefined
					? { limit: PAGE_SIZE }
					: { limit: PAGE_SIZE, after },
			);
			addresses.push(...answer.addresses);
			after = answer.next_cursor;
			if (after === undefined) {
				break;
			}
		}
		return {
			kind: "data",
			domains: topDomains(addresses),
			capped: after !== undefined,
		};
	} catch (error) {
		logApiFailure("overview suppression", error);
		return { kind: "unreachable" };
	}
}

/**
 * The suppression overview of the request: the card that draws it and the
 * notice of the page ask for it, and the API is asked once.
 */
export const requestSuppressionOverview: () => Promise<SuppressionOverview> =
	cache(loadSuppressionOverview);
