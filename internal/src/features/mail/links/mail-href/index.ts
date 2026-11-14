import type { Route } from "next";
import type { ListFilter } from "@/features/mail/schemas/mail-input";
import type { MailboxRole } from "@/features/mail/schemas/mail-view";
import { folderToSegment } from "@/lib/folder-segment";
import { PUBLIC_ROUTES } from "@/lib/routes";

/**
 * What identifies a view of the webmail in its address. The folder is the
 * place and so is in the path; the page, the filter and the search narrow it
 * and are parameters. Anything left out is the default.
 */
export interface MailView {
	/** The folder's id. Left out with no `role`, the view is the inbox. */
	readonly box?: string | undefined;
	/** The folder's role, when it is the account's folder of that role: its path is then the role's. */
	readonly role?: MailboxRole | null | undefined;
	readonly page?: number | undefined;
	readonly filter?: ListFilter | undefined;
	readonly q?: string | undefined;
	/** The open message, the last segment of the path. */
	readonly msg?: string | undefined;
}

/** The list on screen as its links need it: the folder, how it is addressed, and what narrows it. */
export interface ListAddress {
	readonly box: string;
	readonly role: MailboxRole | null;
	readonly page: number;
	readonly filter: ListFilter;
	readonly q: string;
}

/** The path of a folder: `/app/mail/inbox` for a folder with a role, `/app/mail/folder/<name>` for any other. */
export function folderPath(view: Pick<MailView, "box" | "role">): string {
	if (view.role) {
		return `${PUBLIC_ROUTES.mail}/${view.role}`;
	}
	if (view.box) {
		return `${PUBLIC_ROUTES.mail}/folder/${folderToSegment(view.box)}`;
	}
	return `${PUBLIC_ROUTES.mail}/inbox`;
}

/**
 * The address of a view of the webmail: the folder's path, the open message
 * after it, and only the parameters that differ from the default (page 1,
 * filter all, no search), so a view can be bookmarked and the back button
 * walks the views.
 */
export function mailHref(view: MailView): Route {
	const query = new URLSearchParams();
	if (view.page && view.page > 1) {
		query.set("page", String(view.page));
	}
	if (view.filter && view.filter !== "all") {
		query.set("filter", view.filter);
	}
	if (view.q) {
		query.set("q", view.q);
	}
	const message = view.msg ? `/${encodeURIComponent(view.msg)}` : "";
	const suffix = query.size > 0 ? `?${query}` : "";
	return `${folderPath(view)}${message}${suffix}` as Route;
}

/** The address of the composer: empty, or opened as a reply, a forward or a stored draft. */
export function composeHref(
	mode?: "reply" | "replyAll" | "forward" | "draft",
	msg?: string,
): Route {
	if (mode === undefined || msg === undefined) {
		return `${PUBLIC_ROUTES.mail}/compose` as Route;
	}
	return `${PUBLIC_ROUTES.mail}/compose?mode=${mode}&msg=${encodeURIComponent(msg)}` as Route;
}

/** The download address of one attachment; both parts are checked again by the route. */
export function attachmentHref(id: string, part: string): Route {
	return `${PUBLIC_ROUTES.mail}/attachment/${encodeURIComponent(id)}/${encodeURIComponent(part)}` as Route;
}

/**
 * The address of the framed, sanitised body of a message. `theme` is the theme
 * pinned on the page around the frame, if one is: the body is a document of
 * its own and has to be told.
 */
export function bodyHref(
	id: string,
	remoteImages: boolean,
	theme?: "light" | "dark" | undefined,
): Route {
	const query = new URLSearchParams();
	if (remoteImages) {
		query.set("images", "1");
	}
	if (theme !== undefined) {
		query.set("theme", theme);
	}
	const suffix = query.size > 0 ? `?${query}` : "";
	return `${PUBLIC_ROUTES.mail}/body/${encodeURIComponent(id)}${suffix}` as Route;
}
