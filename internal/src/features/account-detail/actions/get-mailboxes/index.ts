"use server";

import { loadMailboxes } from "@/features/account-detail/queries/load-mailboxes";
import { accountInputSchema } from "@/features/account-detail/schemas/account-input";
import type { MailboxRow } from "@/features/account-detail/schemas/account-views";
import type { ActionResult } from "@/lib/query/action-result";
import { runValidatedAction } from "@/lib/query/run-action";

/** Server Action behind the mailboxes query. The account name is validated first. */
export async function getMailboxesAction(
	input: unknown,
): Promise<ActionResult<readonly MailboxRow[]>> {
	return runValidatedAction(
		"account mailboxes",
		accountInputSchema,
		input,
		(data) => loadMailboxes(data.name),
	);
}
