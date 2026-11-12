"use server";

import { loadSuppression } from "@/features/suppression/queries/load-suppression";
import { suppressionPageInputSchema } from "@/features/suppression/schemas/suppression-input";
import type { SuppressionPageView } from "@/features/suppression/schemas/suppression-view";
import type { ActionResult } from "@/lib/query/action-result";
import { runValidatedAction } from "@/lib/query/run-action";

/**
 * Server Action behind the suppression query. The input is validated with the
 * schema the client builds its request from: anything but an optional address
 * cursor is refused before the API is called.
 */
export async function getSuppressionPageAction(
	input: unknown,
): Promise<ActionResult<SuppressionPageView>> {
	return runValidatedAction(
		"suppression fetch",
		suppressionPageInputSchema,
		input,
		(data) => loadSuppression(data.after),
	);
}
