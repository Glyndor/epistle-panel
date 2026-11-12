"use server";

import { loadMasked } from "@/features/account-detail/queries/load-masked";
import { accountInputSchema } from "@/features/account-detail/schemas/account-input";
import type { MaskedRow } from "@/features/account-detail/schemas/account-views";
import type { ActionResult } from "@/lib/query/action-result";
import { runValidatedAction } from "@/lib/query/run-action";

/** Server Action behind the masked-addresses query. */
export async function getMaskedAction(
	input: unknown,
): Promise<ActionResult<readonly MaskedRow[]>> {
	return runValidatedAction(
		"account masked",
		accountInputSchema,
		input,
		(data) => loadMasked(data.name),
	);
}
