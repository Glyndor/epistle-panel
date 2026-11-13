import type { Route } from "next";

/**
 * Every path of the panel, in one place, so a link, a redirect and a navigation
 * entry cannot drift apart. The panel is two products with their own areas:
 *
 * - `/` is the one sign-in page, for every account. It is the only page that
 *   answers without a session; a signed-in visitor is sent on to the mail area.
 * - `/app/mail` is the end-user mail area, for a session of any role.
 * - `/app/{id}` is the administration area, where `{id}` is a UUID v4 chosen for
 *   each installation. It needs a session with the admin role, and everyone else
 *   (no session, no role, another id) gets the same 404 as a path that does not
 *   exist. The id is one more layer of obscurity, not a secret: the session and
 *   the role are the real barrier.
 *
 * This module is pure so client components can import it. Reading the
 * configured id is the job of `lib/config/admin-id`, which is server only.
 */
export const PUBLIC_ROUTES = {
	root: "/",
	mail: "/app/mail",
} as const;

/** The one folder of `/app` that is not the admin area. */
const MAIL_SEGMENT = "mail";

/** A UUID v4 in its canonical lower-case form, the only shape the id may have. */
const ADMIN_ID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** Whether `value` has the shape of an admin id (it says nothing about the configured one). */
export function isAdminIdShape(value: string): boolean {
	return ADMIN_ID_PATTERN.test(value);
}

/**
 * Compare two strings without stopping at the first difference. The loop runs
 * over the longer one and folds the length difference in, so the time does not
 * tell how much of a guess was right.
 */
export function constantTimeEqual(a: string, b: string): boolean {
	let diff = a.length ^ b.length;
	const length = Math.max(a.length, b.length);
	for (let i = 0; i < length; i++) {
		diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
	}
	return diff === 0;
}

/**
 * The paths of the admin area for one installation. The id must have the shape
 * of an admin id; anything else is a programming error, not a path to build.
 */
export function adminRoutes(id: string) {
	if (!isAdminIdShape(id)) {
		throw new Error("the admin id is not a UUID v4");
	}
	const base = `/app/${id}`;
	return {
		home: base as Route,
		domains: `${base}/domains` as Route,
		accounts: `${base}/accounts` as Route,
		queue: `${base}/queue` as Route,
		suppression: `${base}/suppression` as Route,
		deliveries: `${base}/deliveries` as Route,
		/** The detail page of one account; `name` must already be a valid account name. */
		accountDetail: (name: string) => `${base}/accounts/${name}` as Route,
	};
}

/** The admin paths of one installation. */
export type AdminRoutes = ReturnType<typeof adminRoutes>;

/** Where a request path falls, as far as the proxy has to tell. */
export type AppArea =
	/** The root, where the sign-in page is. */
	| { kind: "root" }
	/** `/app/mail` and below. */
	| { kind: "mail" }
	/** `/app/<segment>/...`: the admin area if `segment` is the configured id. */
	| { kind: "admin"; segment: string }
	/** Anything else: no route of the panel answers it, whatever it looks like. */
	| { kind: "other" };

/**
 * Sort a request path into an {@link AppArea}. A path is read the way a router
 * may read it (percent-decoded, backslashes as slashes, repeated slashes
 * collapsed, any letter case for `app` and `mail`, a `;` parameter dropped), so
 * a spelling the proxy and the router disagree on is never let through as
 * something it is not. One that cannot be decoded is `other`. The admin segment
 * is returned as decoded, with its case: the caller compares it with the
 * configured id exactly, and the layout checks it a second time.
 */
export function classifyAppPath(pathname: string): AppArea {
	let decoded: string;
	try {
		decoded = decodeURIComponent(pathname);
	} catch {
		return { kind: "other" };
	}
	const segments = decoded
		.replaceAll("\\", "/")
		.split("/")
		.filter((segment) => segment !== "");
	if (segments.length === 0) {
		return { kind: "root" };
	}
	const second = segments[1]?.split(";")[0];
	if (
		segments[0]?.split(";")[0]?.toLowerCase() !== "app" ||
		second === undefined
	) {
		return { kind: "other" };
	}
	if (second.toLowerCase() === MAIL_SEGMENT) {
		return { kind: "mail" };
	}
	return { kind: "admin", segment: second };
}
