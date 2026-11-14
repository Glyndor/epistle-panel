import { folderToSegment, segmentToFolder } from "../folder-segment";

/**
 * The paths of the mail area, as the proxy has to know them. A page under a
 * `loading.tsx` cannot answer 404 once its frame is on the way, so what is no
 * page is told apart here, before anything is rendered, and gets the panel's
 * one 404. This module is pure: the proxy, a schema and a client component can
 * all import it.
 */

/** The folders an account has by role, each a path of its own: `/app/mail/inbox`. */
export const MAIL_PLACE_ROLES = [
	"inbox",
	"drafts",
	"sent",
	"archive",
	"junk",
	"trash",
] as const;

const char = (code: number) => String.fromCodePoint(code);

/**
 * A mailbox id. epistle names a mailbox by its own name, so it is free text of
 * the account's making; this only refuses what could not be a name: empty,
 * long, or holding a control, a line separator or a bidi control.
 */
export const MAILBOX_ID_PATTERN = new RegExp(
	`^[^\\p{Cc}\\p{Zl}\\p{Zp}${char(0x202a)}-${char(0x202e)}${char(0x2066)}-${char(0x2069)}]{1,256}$`,
	"u",
);

/**
 * A message id: a UUID as the message schema reads one (`z.uuid()`): version
 * 1 to 8 with the RFC variant, or the nil or the max UUID. The proxy and the
 * page read an id with this one rule, so a path the proxy lets through is
 * never one the page then has to refuse: a test holds the two to each other.
 */
const MESSAGE_ID =
	/^(?:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/;

/** Whether `segment` is a message id. */
export function isMessageId(segment: string): boolean {
	return MESSAGE_ID.test(segment);
}

const BASE = "/app/mail";

/** The routes of the mail area that are no folder, each spelled exactly. */
const FIXED = new Set(["compose", "compose-message", "upload"]);

/** Whether `segment` is a folder's name as a link of the panel writes it. */
function isFolderSegment(segment: string): boolean {
	const id = segmentToFolder(segment);
	return id !== null && MAILBOX_ID_PATTERN.test(id);
}

/**
 * Whether a request path is a route of the mail area, read exactly as it is
 * spelled: no decoding and no other case. One slash at the end is the same
 * route, as the router reads it. A folder is
 * `/app/mail/<role>` or `/app/mail/folder/<name>`, with a message's id after
 * it or nothing. Whatever else sits under `/app/mail` (another case, an
 * encoded slash, a segment more, a role that is none, a name the panel does
 * not write) is no route.
 */
export function isMailPath(requested: string): boolean {
	const pathname = requested.endsWith("/")
		? requested.slice(0, -1)
		: requested;
	if (pathname === BASE) {
		return true;
	}
	if (!pathname.startsWith(`${BASE}/`)) {
		return false;
	}
	const [first = "", second, third, ...rest] = pathname
		.slice(BASE.length + 1)
		.split("/");
	if (rest.length > 0) {
		return false;
	}
	if (FIXED.has(first)) {
		return second === undefined;
	}
	if (first === "body") {
		return second !== undefined && second !== "" && third === undefined;
	}
	if (first === "attachment") {
		return Boolean(second) && Boolean(third);
	}
	if (first === "folder") {
		return (
			second !== undefined &&
			isFolderSegment(second) &&
			(third === undefined || MESSAGE_ID.test(third))
		);
	}
	return (
		(MAIL_PLACE_ROLES as readonly string[]).includes(first) &&
		third === undefined &&
		(second === undefined || MESSAGE_ID.test(second))
	);
}

/** What narrows a list, as an old address may carry it. The page it lands on checks each again with its schema. */
const LEGACY_PAGE = /^[0-9]{1,4}$/;
const LEGACY_FILTER = /^[a-z]{1,16}$/;
const LEGACY_QUERY = /^[^\p{Cc}\p{Zl}\p{Zp}]{1,200}$/u;

/**
 * Where an address from before a folder was a path leads:
 * `/app/mail?box=&msg=&page=&filter=&q=` named the folder and the open message
 * as parameters. `null` when the request is not for the mail area's home or
 * names neither. The target is built here, by the proxy, because a redirect
 * thrown by a page under a `loading.tsx` answers 200 with a refresh and not
 * 307. It always starts with the mail area's own path: the folder is written
 * as one segment by {@link folderToSegment}, the message is an id, and a value
 * that fails its check is left out, so nothing in the old query can choose
 * where the redirect goes.
 */
export function legacyMailTarget(
	pathname: string,
	query: URLSearchParams,
): string | null {
	if (pathname !== BASE && pathname !== `${BASE}/`) {
		return null;
	}
	const box = query.get("box");
	const message = query.get("msg");
	const folder = box !== null && MAILBOX_ID_PATTERN.test(box) ? box : null;
	const id = message !== null && isMessageId(message) ? message : null;
	if (folder === null && id === null) {
		return null;
	}
	const kept = new URLSearchParams();
	for (const [name, pattern] of [
		["page", LEGACY_PAGE],
		["filter", LEGACY_FILTER],
		["q", LEGACY_QUERY],
	] as const) {
		const value = query.get(name);
		if (value !== null && pattern.test(value)) {
			kept.set(name, value);
		}
	}
	const place =
		folder === null ? "inbox" : `folder/${folderToSegment(folder)}`;
	const suffix = kept.size > 0 ? `?${kept}` : "";
	return `${BASE}/${place}${id === null ? "" : `/${id}`}${suffix}`;
}
