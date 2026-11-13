"use server";

import { loadMailboxes } from "@/features/mail/queries/load-mailboxes";
import type { MailboxView } from "@/features/mail/schemas/mail-view";
import type { ActionResult } from "@/lib/query/action-result";
import { runMailAction } from "../run-mail-action";

/** Server Action behind the folder tree: the account's mailboxes and their counters. */
export async function getMailboxesAction(): Promise<
	ActionResult<MailboxView[]>
> {
	return runMailAction("mail mailboxes", loadMailboxes);
}
