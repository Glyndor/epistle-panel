"use server";

import { settle } from "@/features/account-detail/queries/settle";
import type { Outcome } from "@/features/account-detail/schemas/outcome";
import { createAccountInputSchema } from "@/features/accounts/schemas/account-input";
import { createAccount } from "@/lib/api/account-lifecycle-client";
import type { ActionResult } from "@/lib/query/action-result";
import { runValidatedAction } from "@/lib/query/run-action";

/**
 * Server Action: create an account the API manages. The answer is the stored
 * name or the category of the refusal, never the password and never the API's
 * message, which can quote what was sent; a failure is logged under a fixed
 * name with no input. The admin session is checked before the schema, so
 * anyone else learns nothing about it.
 */
export async function createAccountAction(
	input: unknown,
): Promise<ActionResult<Outcome<string>>> {
	return runValidatedAction(
		"account create",
		createAccountInputSchema,
		input,
		async (data) => {
			const outcome = await settle(() => createAccount(data));
			return outcome.kind === "done"
				? { kind: "done", value: outcome.value.created }
				: outcome;
		},
	);
}
