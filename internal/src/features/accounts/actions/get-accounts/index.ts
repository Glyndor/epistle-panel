"use server";

import { loadAccounts } from "@/features/accounts/queries/load-accounts";
import type { AccountRow } from "@/features/accounts/schemas/accounts-view";
import type { ActionResult } from "@/lib/query/action-result";
import { runAction } from "@/lib/query/run-action";

/** Server Action behind the accounts query. */
export async function getAccountsAction(): Promise<
	ActionResult<readonly AccountRow[]>
> {
	return runAction("accounts fetch", loadAccounts);
}
