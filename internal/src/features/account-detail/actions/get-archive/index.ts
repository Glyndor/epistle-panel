"use server";

import { loadArchive } from "@/features/account-detail/queries/load-archive";
import { accountInputSchema } from "@/features/account-detail/schemas/account-input";
import type { ArchiveView } from "@/features/account-detail/schemas/account-views";
import type { ActionResult } from "@/lib/query/action-result";
import { runValidatedAction } from "@/lib/query/run-action";

/** Server Action behind the archive query. */
export async function getArchiveAction(
	input: unknown,
): Promise<ActionResult<ArchiveView>> {
	return runValidatedAction(
		"account archive",
		accountInputSchema,
		input,
		(data) => loadArchive(data.name),
	);
}
