"use server";

import { settle } from "@/features/account-detail/queries/settle";
import { displayNameInputSchema } from "@/features/account-detail/schemas/account-input";
import type { DisplayNameView } from "@/features/account-detail/schemas/account-views";
import type { Outcome } from "@/features/account-detail/schemas/outcome";
import { setDisplayName } from "@/lib/api/account-client";
import type { ActionResult } from "@/lib/query/action-result";
import { runValidatedAction } from "@/lib/query/run-action";

/** Server Action: set the person's name of an account, or clear it with an empty value. */
export async function setDisplayNameAction(
	input: unknown,
): Promise<ActionResult<Outcome<DisplayNameView>>> {
	return runValidatedAction(
		"account display name",
		displayNameInputSchema,
		input,
		async (data) => {
			const outcome = await settle(() =>
				setDisplayName(data.name, data.displayName),
			);
			return outcome.kind === "done"
				? {
						kind: "done",
						value: { displayName: outcome.value.display_name },
					}
				: outcome;
		},
	);
}
