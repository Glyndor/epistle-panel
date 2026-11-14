"use server";

import { loadMessage } from "@/features/mail/queries/load-message";
import { messageInputSchema } from "@/features/mail/schemas/mail-input";
import type { MessageDetail } from "@/features/mail/schemas/mail-view";
import type { ActionResult } from "@/lib/query/action-result";
import { runValidatedMailAction } from "../run-mail-action";

/** Server Action behind the reader: one message by id, or `null` when the server has none. */
export async function getMessageAction(
	input: unknown,
): Promise<ActionResult<MessageDetail | null>> {
	return runValidatedMailAction(
		"mail message",
		messageInputSchema,
		input,
		(session, data) => loadMessage(session, data.id),
	);
}
