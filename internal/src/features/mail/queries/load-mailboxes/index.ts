import "server-only";

import { jmapCall, methodResult } from "@/features/mail/jmap/call";
import type { MailSession } from "@/features/mail/jmap/credentials";
import { mailboxGetSchema } from "@/features/mail/jmap/responses";
import { toMailboxTree } from "@/features/mail/queries/to-views";
import type { MailboxView } from "@/features/mail/schemas/mail-view";

/** The account's mailboxes with their counters, as the folder tree shows them. */
export async function loadMailboxes(
	session: MailSession,
): Promise<MailboxView[]> {
	const responses = await jmapCall(session, [
		[
			"Mailbox/get",
			{
				accountId: session.accountId,
				ids: null,
				properties: [
					"id",
					"name",
					"parentId",
					"role",
					"totalEmails",
					"unreadEmails",
				],
			},
			"m",
		],
	]);
	return toMailboxTree(
		methodResult(responses, "m", "Mailbox/get", mailboxGetSchema).list,
	);
}
