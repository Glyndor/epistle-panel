"use server";

import { currentMailSession } from "@/features/mail/jmap/credentials";
import { loadMessage } from "@/features/mail/queries/load-message";
import { messageInputSchema } from "@/features/mail/schemas/mail-input";
import type { MessageDetail } from "@/features/mail/schemas/mail-view";
import type { ActionResult } from "@/lib/query/action-result";
import { runValidatedAction } from "@/lib/query/run-action";

/** Server Action behind the reader: one message by id, or `null` when the server has none. */
export async function getMessageAction(
	input: unknown,
): Promise<ActionResult<MessageDetail | null>> {
	return runValidatedAction(
		"mail message",
		messageInputSchema,
		input,
		async (data) => {
			const session = await currentMailSession();
			if (session === null) {
				throw new Error("no mail session");
			}
			return loadMessage(session, data.id);
		},
	);
}
