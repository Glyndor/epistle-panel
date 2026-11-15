import type { Route } from "next";

import { EMPTY_CONDITIONS } from "@/features/mail/schemas/list-conditions-model";
import type { MailboxView } from "@/features/mail/schemas/mail-view";
import { folderAddress } from "../folder-address";

/**
 * The address of the messages of a folder that carry a label: the folder's
 * path with the `label` condition of the list and nothing else narrowing it.
 * `activeId` is the folder the person is in (`activeFolder`), or `null` when
 * the page is no folder (the composer): the label then opens the inbox. A
 * folder is addressed by its role when it is the first with that role, the
 * way the folder tree links it, and by its id otherwise or when the folders
 * are not known.
 *
 * The server cannot filter by keyword nor look across folders yet
 * (Glyndor/epistle#1790), so the list this opens is the folder's newest
 * messages narrowed by the panel (see `queries/match-conditions`).
 */
export function labelHref(
	keyword: string,
	activeId: string | null,
	boxes: readonly Pick<MailboxView, "id" | "role">[] | undefined,
): Route {
	return folderAddress(activeId, boxes, {
		...EMPTY_CONDITIONS,
		label: keyword,
	});
}
