"use server";

import {
	type LabelOutcome,
	labelMessages,
} from "@/features/mail/queries/label-messages";
import { labelMessagesInputSchema } from "@/features/mail/schemas/label-input";
import type { ActionResult } from "@/lib/query/action-result";
import { runValidatedMailAction } from "../run-mail-action";

/**
 * Server Action that puts a label on messages, takes it off, or makes one from
 * a name and puts it on. The input is the strict schema the client builds
 * from, checked again here whatever the field did; the session is checked
 * before anything else. A message the server did not change comes back in
 * `failed`, so the client puts back only that one.
 */
export async function labelMessagesAction(
	input: unknown,
): Promise<ActionResult<LabelOutcome>> {
	return runValidatedMailAction(
		"mail label",
		labelMessagesInputSchema,
		input,
		(session, data) => labelMessages(session, data),
	);
}
