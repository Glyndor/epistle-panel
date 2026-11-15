import type { MailboxView } from "@/features/mail/schemas/mail-view";

/**
 * One folder of the tree, as the sidebar draws it: the folder itself, whether
 * it has folders under it, whether its branch is open, and the unread count
 * that goes beside it.
 */
export interface FolderEntry {
	readonly box: MailboxView;
	/** True when the folder has folders under it: it gets the control that folds them. */
	readonly hasChildren: boolean;
	/** True when the branch is drawn open. */
	readonly open: boolean;
	/**
	 * True when the branch holds the folder the address shows. Such a branch is
	 * always open and cannot be folded: the sidebar does not hide where the
	 * person is.
	 */
	readonly held: boolean;
	/**
	 * The unread count to draw beside the folder: its own while the branch is
	 * open, the whole branch's while it is folded, so a folded folder still says
	 * what is waiting under it.
	 */
	readonly unread: number;
}

/**
 * The folders of the account as a tree that can be folded: which folders have
 * folders under them, which branches are open, and what each branch holds
 * unread.
 *
 * The folders arrive as a flat list in the order of the tree, each with the
 * parent it hangs from, so the tree is read from that relation and not from
 * the order of the list: a folder that hangs from a folded one is left out
 * with it.
 *
 * The branch that holds the folder the address shows is never folded. A
 * branch that was folded before the person went into it opens itself, and
 * says with `held` that it cannot be folded while it holds them.
 *
 * A folder may name a parent that is not in the list, or itself, or a cycle
 * of two: the list the server sends is built to avoid those, but a walk that
 * could loop would hang the page, so every walk here stops on a folder it has
 * already seen.
 */
export function folderEntries(
	boxes: readonly MailboxView[],
	activeId: string | null,
	folded: ReadonlySet<string>,
): readonly FolderEntry[] {
	const byId = new Map(boxes.map((box) => [box.id, box] as const));
	const childrenOf = new Map<string, string[]>();
	for (const box of boxes) {
		const parent = box.parentId;
		if (parent === null || parent === box.id || !byId.has(parent)) {
			continue;
		}
		const siblings = childrenOf.get(parent);
		if (siblings === undefined) {
			childrenOf.set(parent, [box.id]);
		} else {
			siblings.push(box.id);
		}
	}

	// The folders above the one the address shows: its branch, which stays open.
	const held = new Set<string>();
	const walked = new Set<string>();
	let parent =
		activeId === null ? null : (byId.get(activeId)?.parentId ?? null);
	while (parent !== null && !walked.has(parent)) {
		walked.add(parent);
		if (!byId.has(parent)) {
			break;
		}
		held.add(parent);
		parent = byId.get(parent)?.parentId ?? null;
	}

	/** Whether a branch is folded. The one that holds the current folder is not. */
	const isFolded = (id: string): boolean => folded.has(id) && !held.has(id);

	/** The unread of a branch: the folder's own and every folder under it. */
	const sums = new Map<string, number>();
	const branchUnread = (id: string, walking: Set<string>): number => {
		const known = sums.get(id);
		if (known !== undefined) {
			return known;
		}
		const box = byId.get(id);
		if (box === undefined || walking.has(id)) {
			return 0;
		}
		walking.add(id);
		let total = box.unread;
		for (const child of childrenOf.get(id) ?? []) {
			total += branchUnread(child, walking);
		}
		walking.delete(id);
		sums.set(id, total);
		return total;
	};

	/** Whether a folder is under a folded one, and so out of the tree. */
	const hidden = (box: MailboxView): boolean => {
		const seen = new Set<string>();
		let above = box.parentId;
		while (above !== null && !seen.has(above)) {
			seen.add(above);
			if (isFolded(above)) {
				return true;
			}
			above = byId.get(above)?.parentId ?? null;
		}
		return false;
	};

	const entries: FolderEntry[] = [];
	for (const box of boxes) {
		if (hidden(box)) {
			continue;
		}
		const hasChildren = (childrenOf.get(box.id)?.length ?? 0) > 0;
		const open = !hasChildren || !isFolded(box.id);
		entries.push({
			box,
			hasChildren,
			open,
			held: held.has(box.id),
			unread: open ? box.unread : branchUnread(box.id, new Set()),
		});
	}
	return entries;
}
