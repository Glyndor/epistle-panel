"use server";

import { currentMailSession } from "@/features/mail/jmap/credentials";
import { loadMailboxes } from "@/features/mail/queries/load-mailboxes";
import type { MailboxView } from "@/features/mail/schemas/mail-view";
import type { ActionResult } from "@/lib/query/action-result";
import { runAction } from "@/lib/query/run-action";

/** Server Action behind the folder tree: the account's mailboxes and their counters. */
export async function getMailboxesAction(): Promise<
	ActionResult<MailboxView[]>
> {
	return runAction("mail mailboxes", async () => {
		const session = await currentMailSession();
		if (session === null) {
			throw new Error("no mail session");
		}
		return loadMailboxes(session);
	});
}
