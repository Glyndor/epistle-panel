"use server";

import { currentMailSession } from "@/features/mail/jmap/credentials";
import { loadMessageList } from "@/features/mail/queries/load-message-list";
import { messageListInputSchema } from "@/features/mail/schemas/mail-input";
import type { MessageListView } from "@/features/mail/schemas/mail-view";
import type { ActionResult } from "@/lib/query/action-result";
import { runValidatedAction } from "@/lib/query/run-action";

/**
 * Server Action behind the message list. The input is validated with the
 * strict schema the page builds its request from; the mailbox, the page, the
 * filter and the search text are the only things that reach JMAP.
 */
export async function getMessageListAction(
	input: unknown,
): Promise<ActionResult<MessageListView>> {
	return runValidatedAction(
		"mail list",
		messageListInputSchema,
		input,
		async (data) => {
			const session = await currentMailSession();
			if (session === null) {
				throw new Error("no mail session");
			}
			return loadMessageList(session, data);
		},
	);
}
