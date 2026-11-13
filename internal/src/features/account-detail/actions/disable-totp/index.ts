"use server";

import { settle } from "@/features/account-detail/queries/settle";
import { accountInputSchema } from "@/features/account-detail/schemas/account-input";
import type { Outcome } from "@/features/account-detail/schemas/outcome";
import { disableTotp } from "@/lib/api/account-client";
import type { ActionResult } from "@/lib/query/action-result";
import { runValidatedAction } from "@/lib/query/run-action";

/** Server Action: turn two-factor authentication off for an account. */
export async function disableTotpAction(
	input: unknown,
): Promise<ActionResult<Outcome<true>>> {
	return runValidatedAction(
		"account totp disable",
		accountInputSchema,
		input,
		async (data) => {
			const outcome = await settle(() => disableTotp(data.name));
			return outcome.kind === "done"
				? { kind: "done", value: true }
				: outcome;
		},
	);
}
