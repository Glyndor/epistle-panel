import type { MailboxView } from "@/features/mail/schemas/mail-view";
import { segmentToFolder } from "@/lib/folder-segment";
import { MAIL_PLACE_ROLES } from "@/lib/mail-paths";
import { PUBLIC_ROUTES } from "@/lib/routes";

/** The folder an inbox path opens when no folder has the inbox role, as the page resolves it. */
const FALLBACK_INBOX = "INBOX";

/**
 * The id of the folder a path of the mail area shows, or `null` when the path
 * is no folder (the composer) or names a role the account has no folder for.
 * It reads a path the way the pages do: `/app/mail` is the inbox, a role's
 * path is the first folder with that role, and `/app/mail/folder/<name>` is
 * the folder the segment spells. A message open in a folder is still that
 * folder. The sidebar marks the current folder with it, so the layout that
 * draws the sidebar does not have to know the page.
 */
export function activeFolder(
	pathname: string,
	boxes: readonly Pick<MailboxView, "id" | "role">[],
): string | null {
	const base = PUBLIC_ROUTES.mail;
	if (pathname !== base && !pathname.startsWith(`${base}/`)) {
		return null;
	}
	const [first = "inbox", second] = pathname
		.slice(base.length + 1)
		.split("/")
		.filter((segment) => segment !== "");
	if (first === "folder") {
		return second === undefined ? null : segmentToFolder(second);
	}
	if (!(MAIL_PLACE_ROLES as readonly string[]).includes(first)) {
		return null;
	}
	const found = boxes.find((box) => box.role === first)?.id;
	if (found !== undefined) {
		return found;
	}
	return first === "inbox" ? FALLBACK_INBOX : null;
}
