/**
 * The conditions a folder's list can be narrowed by besides its page, as plain
 * values. No schema library here, so a client component (a search form, the
 * chips of a search) can import it cheaply; the schemas that read them from an
 * address live in `list-conditions`.
 */

/** Longest text of a text condition, in characters: the rule `q` has always had. */
export const MAX_CONDITION_TEXT = 200;

/**
 * The characters a text condition may not hold: the controls, the line and
 * paragraph separators. It is the pattern of the browser's own check, of the
 * schema on the server and of the one in the page.
 */
export const CONDITION_TEXT_PATTERN = /^[^\p{Cc}\p{Zl}\p{Zp}]*$/u;

/** Earliest year a day condition names. */
export const FIRST_CONDITION_YEAR = 1970;

/** Latest year a day condition names: a day is written with four digits. */
export const LAST_CONDITION_YEAR = 9999;

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Whether `text` is `YYYY-MM-DD`, a day of the calendar, in the years a
 * condition names. `Date.UTC` rolls 2026-02-30 over into March: that is not a
 * day.
 */
export function isConditionDay(text: string): boolean {
	const match = ISO_DAY.exec(text);
	if (match === null) {
		return false;
	}
	const [year, month, date] = [
		Number(match[1]),
		Number(match[2]),
		Number(match[3]),
	];
	if (year < FIRST_CONDITION_YEAR || year > LAST_CONDITION_YEAR) {
		return false;
	}
	const back = new Date(Date.UTC(year, month - 1, date));
	return (
		back.getUTCFullYear() === year &&
		back.getUTCMonth() === month - 1 &&
		back.getUTCDate() === date
	);
}

/** How the list is sorted. The first is the default and what the server sends. */
export const LIST_ORDERS = ["newest", "oldest", "largest"] as const;
export type ListOrder = (typeof LIST_ORDERS)[number];

/**
 * The quick filters of the list, each one a condition of its own: they are the
 * ticks of one group and several of them can be on at once, which a single
 * parameter could not say.
 */
export const QUICK_FILTERS = [
	"unread",
	"starred",
	"important",
	"attachment",
] as const;
export type QuickFilter = (typeof QUICK_FILTERS)[number];

/**
 * The parameters of the address that hold a condition, in the order they are
 * written back and reported. `filter` and `page` are read with the rest of the
 * list's input, not here.
 */
export const CONDITION_NAMES = [
	"q",
	"from",
	"to",
	"subject",
	"after",
	"before",
	"label",
	"folder",
	"unread",
	"starred",
	"important",
	"attachment",
	"order",
] as const;
export type ConditionName = (typeof CONDITION_NAMES)[number];

/**
 * Every condition of a list, each one present. A text that narrows nothing is
 * `""`, a day, a label or a folder that narrows nothing is `null`, and a quick
 * filter that is off is `false`. A day is `YYYY-MM-DD` in UTC and both ends are
 * included; `after` is never later than `before`.
 */
export interface ListConditions {
	/** Words anywhere in the subject, the preview or the sender and recipients. */
	q: string;
	/** Text in the name or the address of a sender. */
	from: string;
	/** Text in the name or the address of a recipient. */
	to: string;
	/** Text in the subject. */
	subject: string;
	/** First day kept. */
	after: string | null;
	/** Last day kept. */
	before: string | null;
	/** A keyword the message holds. */
	label: string | null;
	/** The folder the list is read from, when it is not the one of the page. */
	folder: string | null;
	/** Keep the messages that were not read. */
	unread: boolean;
	/** Keep the messages that are starred. */
	starred: boolean;
	/** Keep the messages the reader marked as important. */
	important: boolean;
	/** Keep the messages that carry an attachment. */
	attachment: boolean;
	order: ListOrder;
}

/** The list with nothing narrowed and the default order. */
export const EMPTY_CONDITIONS: Readonly<ListConditions> = Object.freeze({
	q: "",
	from: "",
	to: "",
	subject: "",
	after: null,
	before: null,
	label: null,
	folder: null,
	unread: false,
	starred: false,
	important: false,
	attachment: false,
	order: "newest",
});

/** Whether `order` is the one the list has when the address names none. */
export function isDefaultOrder(order: ListOrder): boolean {
	return order === EMPTY_CONDITIONS.order;
}

/** Whether a condition holds its default value. */
function isDefault(conditions: ListConditions, name: ConditionName): boolean {
	return conditions[name] === EMPTY_CONDITIONS[name];
}

/**
 * Whether the conditions keep fewer messages than the whole folder. The order
 * changes where a message shows, not whether it does, so it does not count.
 */
export function hasConditions(conditions: ListConditions): boolean {
	return CONDITION_NAMES.some(
		(name) => name !== "order" && !isDefault(conditions, name),
	);
}

/**
 * The parameters that write the conditions into an address: only the ones
 * that are not the default, in the order of {@link CONDITION_NAMES}, each
 * value as it is read back. Encoding them is the caller's (`URLSearchParams`).
 */
export function conditionsToQuery(
	conditions: ListConditions,
): [name: ConditionName, value: string][] {
	const query: [name: ConditionName, value: string][] = [];
	for (const name of CONDITION_NAMES) {
		const value = conditions[name];
		if (value === null || isDefault(conditions, name)) {
			continue;
		}
		// A quick filter is a tick: it is on or it is not, and the address
		// says it with a mark and nothing else.
		query.push([
			name,
			typeof value === "boolean" ? (value ? "1" : "") : value,
		]);
	}
	return query;
}

/**
 * The name of the field each condition is set in, as a key of the `mail`
 * namespace: a chip says which one it is, and a condition the server did not
 * apply is named with the same word.
 */
export const CONDITION_LABELS = {
	q: "searchWords",
	from: "from",
	to: "to",
	subject: "fieldSubject",
	after: "conditionAfter",
	before: "conditionBefore",
	label: "conditionLabel",
	folder: "conditionFolder",
	unread: "filterUnread",
	starred: "filterFlagged",
	important: "filterImportant",
	attachment: "hasAttachment",
	order: "conditionOrder",
} as const satisfies Record<ConditionName, string>;

/**
 * The conditions that narrow the list, in the order they are written. The
 * order is not one of them: it says where a message shows, not whether it
 * does.
 */
export function activeConditions(conditions: ListConditions): ConditionName[] {
	return CONDITION_NAMES.filter(
		(name) => name !== "order" && !isDefault(conditions, name),
	);
}

/** The conditions with one of them back to its default: what taking off one chip of a search leaves. */
export function withoutCondition(
	conditions: ListConditions,
	name: ConditionName,
): ListConditions {
	return { ...conditions, [name]: EMPTY_CONDITIONS[name] };
}
