import "server-only";

import type { MailboxRow } from "@/features/account-detail/schemas/account-views";
import { getMailboxes } from "@/lib/api/account-client";
import type { AccountName } from "@/lib/api/schemas";

/** Deepest nesting drawn; a deeper mailbox is shown at this level. */
const MAX_DEPTH = 4;

/** Read the mailboxes of an account as rows in tree order, each with its depth. */
export async function loadMailboxes(
	name: AccountName,
): Promise<readonly MailboxRow[]> {
	const { tree } = await getMailboxes(name);
	const parents = new Map(tree.map((entry) => [entry.id, entry.parent_id]));
	const depthOf = (id: string): number => {
		let depth = 0;
		let parent = parents.get(id) ?? null;
		while (parent !== null && depth < MAX_DEPTH) {
			depth += 1;
			parent = parents.get(parent) ?? null;
		}
		return depth;
	};
	return tree.map(({ id, name: leaf }) => ({
		id,
		name: leaf,
		depth: depthOf(id),
	}));
}
