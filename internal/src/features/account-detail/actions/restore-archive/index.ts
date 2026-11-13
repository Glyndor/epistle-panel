"use server";

import { settle } from "@/features/account-detail/queries/settle";
import { restoreArchivedInputSchema } from "@/features/account-detail/schemas/account-input";
import type { RestoredView } from "@/features/account-detail/schemas/account-views";
import type { Outcome } from "@/features/account-detail/schemas/outcome";
import { restoreArchived } from "@/lib/api/account-client";
import type { ActionResult } from "@/lib/query/action-result";
import { runValidatedAction } from "@/lib/query/run-action";

/** Server Action: put one archived message back in its mailbox, or in the inbox when that is gone. */
export async function restoreArchiveAction(
	input: unknown,
): Promise<ActionResult<Outcome<RestoredView>>> {
	return runValidatedAction(
		"account archive restore",
		restoreArchivedInputSchema,
		input,
		async (data) => {
			const outcome = await settle(() =>
				restoreArchived(data.name, data.id),
			);
			return outcome.kind === "done"
				? {
						kind: "done",
						value: { restoredTo: outcome.value.restored_to },
					}
				: outcome;
		},
	);
}
