import "server-only";

import type { AccountRow } from "@/features/accounts/schemas/accounts-view";
import { getAccounts } from "@/lib/api/client";

/** Read the mail accounts from the API as table rows. */
export async function loadAccounts(): Promise<readonly AccountRow[]> {
	const { accounts } = await getAccounts();
	return accounts.map(({ name, addresses }) => ({ name, addresses }));
}
