import { queryOptions } from "@tanstack/react-query";

import type { AccountRow } from "@/features/accounts/schemas/accounts-view";

/** Query keys of the accounts feature. */
export const accountsKeys = {
	all: ["accounts"] as const,
};

/** Options of the accounts query, shared by the server prefetch and the browser. */
export function accountsQueryOptions(
	fetcher: () => Promise<readonly AccountRow[]>,
) {
	return queryOptions({
		queryKey: accountsKeys.all,
		queryFn: fetcher,
	});
}
