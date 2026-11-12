import { keepPreviousData, queryOptions } from "@tanstack/react-query";

import type { SuppressionPageView } from "@/features/suppression/schemas/suppression-view";

/** Query keys of the suppression feature. A page is keyed by its cursor, `null` for the first. */
export const suppressionKeys = {
	all: ["suppression"] as const,
	page: (after: string | undefined) =>
		["suppression", "page", after ?? null] as const,
};

/** How often the list refreshes while the tab is in view, in milliseconds. */
export const SUPPRESSION_REFRESH_MS = 30_000;

/**
 * Options of one page of the suppression list, shared by the server prefetch
 * and the browser. The previous page stays on screen while the next loads.
 * Polls only while the tab is in view: bounces add addresses on their own.
 */
export function suppressionQueryOptions(
	after: string | undefined,
	fetcher: (after: string | undefined) => Promise<SuppressionPageView>,
) {
	return queryOptions({
		queryKey: suppressionKeys.page(after),
		queryFn: () => fetcher(after),
		placeholderData: keepPreviousData,
		refetchInterval: SUPPRESSION_REFRESH_MS,
		refetchIntervalInBackground: false,
	});
}
