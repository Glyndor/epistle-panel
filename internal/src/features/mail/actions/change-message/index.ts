"use server";

import { currentMailSession } from "@/features/mail/jmap/credentials";
import {
	type ChangeOutcome,
	changeMessage,
	NoFolderError,
} from "@/features/mail/queries/change-message";
import { changeMessageInputSchema } from "@/features/mail/schemas/mail-input";
import type { ActionResult } from "@/lib/query/action-result";
import { runValidatedAction } from "@/lib/query/run-action";

/** What the change action answers: what happened, or that the account has no such folder. */
export type ChangeResult =
	| { readonly kind: "done"; readonly outcome: ChangeOutcome }
	| { readonly kind: "noFolder" };

/**
 * Server Action that changes one message: read state, star, archive, trash,
 * spam, back to the inbox, or a move to a named folder. The input is the strict
 * schema the client builds from; the session is checked before anything else.
 * A missing system folder is a category the interface can say, not an error.
 */
export async function changeMessageAction(
	input: unknown,
): Promise<ActionResult<ChangeResult>> {
	return runValidatedAction(
		"mail change",
		changeMessageInputSchema,
		input,
		async (data) => {
			const session = await currentMailSession();
			if (session === null) {
				throw new Error("no mail session");
			}
			try {
				return {
					kind: "done",
					outcome: await changeMessage(session, data),
				} as const;
			} catch (error) {
				if (error instanceof NoFolderError) {
					return { kind: "noFolder" } as const;
				}
				throw error;
			}
		},
	);
}
