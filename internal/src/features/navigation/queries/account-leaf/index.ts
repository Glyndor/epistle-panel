import "server-only";

import { accountsQueryOptions } from "@/features/accounts/queries/accounts-query";
import { loadAccounts } from "@/features/accounts/queries/load-accounts";
import { parseAccountNameParam } from "@/lib/api/schemas";
import { prefetch } from "@/lib/query/prefetch";
import { getServerQueryClient } from "@/lib/query/server-query-client";

/**
 * The account an address names, for the trail of its page, by the rule the
 * page itself follows: the segment must be an account name (`..`, a path, a
 * header or a non-ASCII letter is none, and the API is asked nothing), and it
 * must be on the accounts list. `undefined` for a segment that names no
 * account, so the trail never shows as a page something that is not one. When
 * the list cannot be read the name stands, as it does in the page's heading.
 *
 * The list is read into the request's own query client, the one the page
 * reads it into, so the two share one call.
 */
export async function accountLeaf(
	segment: string,
): Promise<string | undefined> {
	const name = parseAccountNameParam(segment);
	if (name === undefined) {
		return undefined;
	}
	const client = getServerQueryClient();
	const query = accountsQueryOptions(loadAccounts);
	await prefetch(client, query, "accounts fetch");
	const accounts = client.getQueryData(query.queryKey);
	return accounts && !accounts.some((row) => row.name === name)
		? undefined
		: name;
}
