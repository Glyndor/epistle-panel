"use server";

import { removeAddressInputSchema } from "@/features/suppression/schemas/suppression-input";
import { removeSuppression } from "@/lib/api/client";
import type { ActionResult } from "@/lib/query/action-result";
import { runValidatedAction } from "@/lib/query/run-action";

/**
 * Server Action: take one address off the global suppression list, which lets
 * the server send to it again. The address has to pass the address schema (no
 * line break, no control character, bounded length) and nothing else is
 * accepted; it is percent-encoded into the URL by the client of the API. The
 * session is checked here as well as in the proxy: a Server Action is a public
 * POST endpoint.
 */
export async function removeAddressAction(
	input: unknown,
): Promise<ActionResult<{ readonly removed: string }>> {
	return runValidatedAction(
		"suppression remove",
		removeAddressInputSchema,
		input,
		async (data) => {
			await removeSuppression(data.address);
			return { removed: data.address };
		},
	);
}
