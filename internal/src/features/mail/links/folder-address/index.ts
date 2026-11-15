import type { Route } from "next";

import type { ListConditions } from "@/features/mail/schemas/list-conditions-model";
import type { MailboxView } from "@/features/mail/schemas/mail-view";
import { mailHref } from "../mail-href";

/**
 * The address of the folder the person is in, narrowed by `conditions`.
 * `activeId` is the folder the person is in (`activeFolder`), or `null` when
 * the page is no folder (the composer): the address is then the inbox's. A
 * folder is addressed by its role when it is the first with that role, the
 * way the folder tree links it, and by its id otherwise or when the folders
 * are not known. What the sidebar's links that narrow the current folder
 * (a label, a day) share, so that none of them spells the rule again.
 */
export function folderAddress(
	activeId: string | null,
	boxes: readonly Pick<MailboxView, "id" | "role">[] | undefined,
	conditions: ListConditions,
): Route {
	if (activeId === null) {
		return mailHref({ role: "inbox", conditions });
	}
	const box = boxes?.find((one) => one.id === activeId);
	const role =
		box?.role != null && boxes?.find((one) => one.role === box.role) === box
			? box.role
			: null;
	return mailHref({ box: activeId, role, conditions });
}
