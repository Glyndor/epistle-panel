import { z } from "zod";

/**
 * A mailbox id. epistle names a mailbox by its own name, so it is free text of
 * the account's making; the schema only refuses what could not be a name:
 * empty, long, or holding a control, a line separator or a bidi control.
 */
const MAILBOX_ID = /^[^\p{Cc}\p{Zl}\p{Zp}‪-‮⁦-⁩]{1,256}$/u;
export const mailboxIdSchema = z.string().regex(MAILBOX_ID);

/** The id of a message: epistle issues a UUID. */
export const messageIdSchema = z.uuid();

/** The index of a MIME part of a message: digits only, as the JMAP blob id `<message>.<index>` spells it. */
export const partIndexSchema = z.string().regex(/^[0-9]{1,6}$/);

/** What the list can be narrowed to besides the folder. */
export const LIST_FILTERS = [
	"all",
	"unread",
	"flagged",
	"attachments",
] as const;
export const listFilterSchema = z.enum(LIST_FILTERS);
export type ListFilter = z.infer<typeof listFilterSchema>;

/** Messages on one page of the list. */
export const PAGE_SIZE = 50;

/** Most pages the list reaches, so the page number is bounded input. */
export const MAX_PAGE = 200;

/** Most ids one `Email/get` names: epistle's `maxObjectsInGet`. */
export const GET_CHUNK = 500;

/**
 * Most messages a filter or a search reads. epistle's `Email/query` takes only
 * a mailbox, so narrowing a folder means fetching its messages and keeping the
 * ones that match; reading the newest part bounds the cost and the answer says
 * when it did.
 */
export const SCAN_LIMIT = 1000;

/** Longest search text read, in characters. */
export const MAX_QUERY_LENGTH = 200;

/**
 * Input of the message-list action. Strict, so a field the client adds never
 * reaches the server call. The search text is trimmed and has no control
 * character.
 */
export const messageListInputSchema = z.strictObject({
	box: mailboxIdSchema,
	page: z.number().int().min(1).max(MAX_PAGE),
	filter: listFilterSchema,
	q: z
		.string()
		.max(MAX_QUERY_LENGTH)
		.regex(/^[^\p{Cc}\p{Zl}\p{Zp}]*$/u)
		.transform((value) => value.trim()),
});
export type MessageListInput = z.output<typeof messageListInputSchema>;

/** Input of the message action: one id and whether remote images were asked for. */
export const messageInputSchema = z.strictObject({
	id: messageIdSchema,
});
export type MessageInput = z.output<typeof messageInputSchema>;

/** The first value of a query parameter, which Next hands over as an array when it repeats. */
function firstValue(value: string | string[] | undefined): string | undefined {
	return Array.isArray(value) ? value[0] : value;
}

/** What `?box=&page=&filter=&q=&msg=` of the mail page holds once each is checked on its own. */
export interface MailParams {
	readonly box: string | undefined;
	readonly page: number;
	readonly filter: ListFilter;
	readonly q: string;
	readonly msg: string | undefined;
}

/**
 * Read the mail page's query parameters. Each parameter is checked alone and a
 * bad one is dropped (the others stay), so a hand-edited link degrades to the
 * default instead of an error, and nothing unchecked is forwarded to the API.
 */
export function parseMailParams(
	raw: Readonly<Record<string, string | string[] | undefined>>,
): MailParams {
	const box = mailboxIdSchema.safeParse(firstValue(raw["box"]));
	const pageText = firstValue(raw["page"]);
	const page = messageListInputSchema.shape.page.safeParse(
		pageText !== undefined && /^[0-9]{1,4}$/.test(pageText)
			? Number(pageText)
			: undefined,
	);
	const filter = listFilterSchema.safeParse(firstValue(raw["filter"]));
	const q = messageListInputSchema.shape.q.safeParse(
		firstValue(raw["q"]) ?? "",
	);
	const msg = messageIdSchema.safeParse(firstValue(raw["msg"]));
	return {
		box: box.success ? box.data : undefined,
		page: page.success ? page.data : 1,
		filter: filter.success ? filter.data : "all",
		q: q.success ? q.data : "",
		msg: msg.success ? msg.data : undefined,
	};
}
