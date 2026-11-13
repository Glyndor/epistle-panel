"use server";

import { settle } from "@/features/account-detail/queries/settle";
import { createMaskedInputSchema } from "@/features/account-detail/schemas/account-input";
import type { MaskedCreatedView } from "@/features/account-detail/schemas/account-views";
import type { Outcome } from "@/features/account-detail/schemas/outcome";
import { createMasked } from "@/lib/api/account-client";
import type { ActionResult } from "@/lib/query/action-result";
import { runValidatedAction } from "@/lib/query/run-action";

/**
 * Server Action: mint a masked address from a label. A label without a letter
 * or digit is `rejected` by the schema and by the API alike, and an account at
 * its cap of masked addresses is a `conflict`.
 */
export async function createMaskedAction(
	input: unknown,
): Promise<ActionResult<Outcome<MaskedCreatedView>>> {
	return runValidatedAction(
		"account masked create",
		createMaskedInputSchema,
		input,
		async (data) => {
			const outcome = await settle(() =>
				createMasked(data.name, data.label),
			);
			return outcome.kind === "done"
				? { kind: "done", value: { address: outcome.value.address } }
				: outcome;
		},
	);
}
