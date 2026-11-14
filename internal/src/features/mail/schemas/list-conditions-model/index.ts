/**
 * The conditions a folder's list can be narrowed by besides its filter and its
 * page, as plain values. No schema library here, so a client component (a
 * search form, the chips of a search) can import it cheaply; the schemas that
 * read them from an address live in `list-conditions`.
 */

/** Longest text of a text condition, in characters: the rule `q` has always had. */
export const MAX_CONDITION_TEXT = 200;

/** Earliest year a day condition names. */
export const FIRST_CONDITION_YEAR = 1970;

/** Latest year a day condition names: a day is written with four digits. */
export const LAST_CONDITION_YEAR = 9999;

/** How the list is sorted. The first is the default and what the server sends. */
export const LIST_ORDERS = ["newest", "oldest", "largest"] as const;
export type ListOrder = (typeof LIST_ORDERS)[number];

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
	"order",
] as const;
export type ConditionName = (typeof CONDITION_NAMES)[number];

/**
 * Every condition of a list, each one present. A text that narrows nothing is
 * `""`, a day or a label that narrows nothing is `null`. A day is `YYYY-MM-DD`
 * in UTC and both ends are included; `after` is never later than `before`.
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
		if (value !== null && !isDefault(conditions, name)) {
			query.push([name, value]);
		}
	}
	return query;
}

/** The conditions with one of them back to its default: what taking off one chip of a search leaves. */
export function withoutCondition(
	conditions: ListConditions,
	name: ConditionName,
): ListConditions {
	return { ...conditions, [name]: EMPTY_CONDITIONS[name] };
}
