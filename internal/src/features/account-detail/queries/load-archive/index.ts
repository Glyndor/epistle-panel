import "server-only";

import { settle } from "@/features/account-detail/queries/settle";
import type { ArchiveView } from "@/features/account-detail/schemas/account-views";
import { getArchive } from "@/lib/api/account-client";
import type { AccountName } from "@/lib/api/schemas";

/**
 * Read the archive of an account. A `404` is the archive being off or empty of
 * history, so it comes back as the `unavailable` state, not as an error that
 * would be logged on every visit; the page has already confirmed the account.
 */
export async function loadArchive(name: AccountName): Promise<ArchiveView> {
	const outcome = await settle(() => getArchive(name));
	if (outcome.kind !== "done") {
		return { state: "unavailable" };
	}
	return {
		state: "available",
		entries: outcome.value.entries.map((entry) => ({
			id: entry.id,
			mailbox: entry.mailbox,
			deletedAt: entry.deleted_at,
		})),
	};
}
