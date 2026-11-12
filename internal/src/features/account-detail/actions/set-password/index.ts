"use server";

import { settle } from "@/features/account-detail/queries/settle";
import { passwordInputSchema } from "@/features/account-detail/schemas/account-input";
import type { Outcome } from "@/features/account-detail/schemas/outcome";
import { setPassword } from "@/lib/api/account-client";
import type { ActionResult } from "@/lib/query/action-result";
import { runValidatedAction } from "@/lib/query/run-action";

/**
 * Server Action: replace an account's password. The answer says only whether it
 * worked, never the password and never the API's message, which can quote it,
 * and a failure is logged under a fixed name with no input. The session is
 * checked before the schema, so an anonymous caller learns nothing.
 */
export async function setPasswordAction(
	input: unknown,
): Promise<ActionResult<Outcome<true>>> {
	return runValidatedAction(
		"account password",
		passwordInputSchema,
		input,
		async (data) => {
			const outcome = await settle(() =>
				setPassword(data.name, data.password),
			);
			return outcome.kind === "done"
				? { kind: "done", value: true }
				: outcome;
		},
	);
}
