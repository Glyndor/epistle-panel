import type { Route } from "next";

import type { ListFilter } from "@/features/mail/schemas/mail-input";
import { PUBLIC_ROUTES } from "@/lib/routes";

/** What identifies a view of the webmail in its address. Anything left out is the default. */
export interface MailView {
	readonly box?: string | undefined;
	readonly page?: number | undefined;
	readonly filter?: ListFilter | undefined;
	readonly q?: string | undefined;
	readonly msg?: string | undefined;
}

/**
 * The address of a view of the webmail: `/app/mail` with only the parameters
 * that differ from the default (page 1, filter all, no search, no message), so
 * a view can be bookmarked and the back button walks the views.
 */
export function mailHref(view: MailView): Route {
	const query = new URLSearchParams();
	if (view.box) {
		query.set("box", view.box);
	}
	if (view.page && view.page > 1) {
		query.set("page", String(view.page));
	}
	if (view.filter && view.filter !== "all") {
		query.set("filter", view.filter);
	}
	if (view.q) {
		query.set("q", view.q);
	}
	if (view.msg) {
		query.set("msg", view.msg);
	}
	const suffix = query.size > 0 ? `?${query}` : "";
	return `${PUBLIC_ROUTES.mail}${suffix}` as Route;
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

/** The address of the framed, sanitised body of a message. */
export function bodyHref(id: string, remoteImages: boolean): Route {
	return `${PUBLIC_ROUTES.mail}/body/${encodeURIComponent(id)}${remoteImages ? "?images=1" : ""}` as Route;
}
