import { queryOptions } from "@tanstack/react-query";

import type { DomainRow } from "@/features/domains/schemas/domains-view";

/** Query keys of the domains feature. */
export const domainsKeys = {
	all: ["domains"] as const,
};

/**
 * Options of the domains query, shared by the server prefetch and the browser.
 * Domains change rarely, so there is no polling: the 30 s freshness of the
 * client and a refetch on window focus are enough.
 */
export function domainsQueryOptions(
	fetcher: () => Promise<readonly DomainRow[]>,
) {
	return queryOptions({
		queryKey: domainsKeys.all,
		queryFn: fetcher,
	});
}
