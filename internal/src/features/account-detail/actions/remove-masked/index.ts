"use server";

import { settle } from "@/features/account-detail/queries/settle";
import { removeMaskedInputSchema } from "@/features/account-detail/schemas/account-input";
import type { Outcome } from "@/features/account-detail/schemas/outcome";
import { removeMasked } from "@/lib/api/account-client";
import type { ActionResult } from "@/lib/query/action-result";
import { runValidatedAction } from "@/lib/query/run-action";

/**
 * Server Action: remove one masked address. Irreversible, so the address has to
 * have the shape the server mints, which also keeps `/` and `..` out of the path.
 */
export async function removeMaskedAction(
	input: unknown,
): Promise<ActionResult<Outcome<true>>> {
	return runValidatedAction(
		"account masked remove",
		removeMaskedInputSchema,
		input,
		async (data) => {
			const outcome = await settle(() =>
				removeMasked(data.name, data.address),
			);
			return outcome.kind === "done"
				? { kind: "done", value: true }
				: outcome;
		},
	);
}
