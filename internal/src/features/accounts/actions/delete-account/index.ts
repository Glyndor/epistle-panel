"use server";

import { settle } from "@/features/account-detail/queries/settle";
import type { Outcome } from "@/features/account-detail/schemas/outcome";
import { deleteAccountInputSchema } from "@/features/accounts/schemas/account-input";
import { deleteAccount } from "@/lib/api/account-lifecycle-client";
import type { ActionResult } from "@/lib/query/action-result";
import { runValidatedAction } from "@/lib/query/run-action";

/** What a deleted account leaves behind in the queue: messages still to be delivered, and messages dropped. */
export interface QueueAfterDelete {
	readonly left: number;
	readonly discarded: number;
}

/**
 * Server Action: delete an account the API manages, with the choice the API
 * requires for the mail it has queued. An account declared in the
 * configuration file is not the API's to delete and comes back as `notFound`.
 * The admin session is checked before the schema.
 */
export async function deleteAccountAction(
	input: unknown,
): Promise<ActionResult<Outcome<QueueAfterDelete>>> {
	return runValidatedAction(
		"account delete",
		deleteAccountInputSchema,
		input,
		async (data) => {
			const outcome = await settle(() =>
				deleteAccount(data.name, data.queue),
			);
			return outcome.kind === "done"
				? {
						kind: "done",
						value: {
							left: outcome.value.queued_messages_left,
							discarded: outcome.value.queued_messages_discarded,
						},
					}
				: outcome;
		},
	);
}
