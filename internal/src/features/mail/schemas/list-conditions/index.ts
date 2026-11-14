import { z } from "zod";

import {
	isKeywordAtom,
	isLabelKeyword,
} from "@/features/mail/labels/keyword-codec";
import {
	CONDITION_NAMES,
	CONDITION_TEXT_PATTERN,
	type ConditionName,
	FIRST_CONDITION_YEAR,
	isConditionDay,
	LAST_CONDITION_YEAR,
	LIST_ORDERS,
	type ListConditions,
	MAX_CONDITION_TEXT,
	type QUICK_FILTERS,
	type QuickFilter,
} from "@/features/mail/schemas/list-conditions-model";
import { MAILBOX_ID_PATTERN } from "@/lib/mail-paths";

export {
	activeConditions,
	CONDITION_LABELS,
	CONDITION_NAMES,
	type ConditionName,
	conditionsToQuery,
	EMPTY_CONDITIONS,
	FIRST_CONDITION_YEAR,
	hasConditions,
	isDefaultOrder,
	LAST_CONDITION_YEAR,
	LIST_ORDERS,
	type ListConditions,
	type ListOrder,
	MAX_CONDITION_TEXT,
	QUICK_FILTERS,
	type QuickFilter,
	withoutCondition,
} from "@/features/mail/schemas/list-conditions-model";

/**
 * A text condition (`q`, `from`, `to`, `subject`): at most
 * {@link MAX_CONDITION_TEXT} characters as written, no control character and
 * no line or paragraph separator, trimmed. The same rule `q` has always had.
 */
export const conditionTextSchema = z
	.string()
	.max(MAX_CONDITION_TEXT)
	.regex(CONDITION_TEXT_PATTERN)
	.transform((value) => value.trim());

/**
 * A day condition (`after`, `before`): exactly `YYYY-MM-DD`, a real day of
 * the calendar, from {@link FIRST_CONDITION_YEAR} to
 * {@link LAST_CONDITION_YEAR}. Kept as written, so it goes back into the
 * address unchanged.
 */
export const conditionDaySchema = z.string().refine(isConditionDay);

/**
 * A label condition: a keyword the server would keep that is a label and not
 * one of the protocol's. Kept as written: the server matches a keyword
 * without regard to case, and so does the list.
 */
export const conditionLabelSchema = z
	.string()
	.refine((value) => isKeywordAtom(value) && isLabelKeyword(value));

/**
 * A folder condition: the mailbox the list is read from, when it is not the
 * one of the page. A mailbox id is the name epistle knows the folder by, so it
 * is free text of the account's making, with the controls a name cannot hold.
 */
export const conditionFolderSchema = z.string().regex(MAILBOX_ID_PATTERN);

/** How the list is sorted. */
export const listOrderSchema = z.enum(LIST_ORDERS);

/**
 * A quick filter: a tick of the group. The address says it with a mark and
 * nothing else, so a value that is not the mark is not a tick.
 */
export const conditionTickSchema = z.literal("1");

/** Whether two days, each one a condition day, leave a range with no day in it. */
function isEmptyRange(after: string | null, before: string | null): boolean {
	// Two `YYYY-MM-DD` of four-digit years sort as text the way they sort as days.
	return after !== null && before !== null && after > before;
}

/**
 * Every condition of a list, as a server action reads it from the client.
 * Strict, so a field the client adds never reaches the server call, and every
 * field is required: the client sends the whole {@link ListConditions}. A
 * range whose `after` is later than its `before` is refused on both fields.
 */
export const listConditionsSchema = z
	.strictObject({
		q: conditionTextSchema,
		from: conditionTextSchema,
		to: conditionTextSchema,
		subject: conditionTextSchema,
		after: conditionDaySchema.nullable(),
		before: conditionDaySchema.nullable(),
		label: conditionLabelSchema.nullable(),
		folder: conditionFolderSchema.nullable(),
		unread: z.boolean(),
		starred: z.boolean(),
		important: z.boolean(),
		attachment: z.boolean(),
		order: listOrderSchema,
	})
	.superRefine((value, context) => {
		// zod runs this even when a field failed: a day that is not one has
		// its own issue already and says nothing about the range.
		const [after, before] = [value.after, value.before].map((day) =>
			day !== null && isConditionDay(day) ? day : null,
		) as [string | null, string | null];
		if (isEmptyRange(after, before)) {
			for (const path of ["after", "before"] as const) {
				context.addIssue({
					code: "custom",
					path: [path],
					message: "after is later than before",
				});
			}
		}
	}) satisfies z.ZodType<ListConditions>;

/** The first value of a query parameter, which Next hands over as an array when it repeats. */
function firstValue(value: string | string[] | undefined): string | undefined {
	return Array.isArray(value) ? value[0] : value;
}

/**
 * The filters of the address from before the quick filters were conditions
 * of their own: one at a time, and the name the panel has always used for
 * them. A link from before still says what it said.
 */
const LEGACY_FILTERS: Readonly<Record<string, QuickFilter>> = {
	unread: "unread",
	flagged: "starred",
	attachments: "attachment",
};

/** What the address said about the conditions: what is applied and what was not. */
export interface ParsedConditions {
	readonly conditions: ListConditions;
	/** The parameters that held a value and were dropped, in the order of {@link CONDITION_NAMES}. */
	readonly rejected: readonly ConditionName[];
}

/**
 * Read the conditions from a folder's query string. Each parameter is checked
 * alone: a bad one is dropped and named in `rejected`, and the others stay, so
 * the page can say which condition it did not apply instead of showing the
 * whole folder as if it had matched. A parameter that is absent or empty is
 * no condition and no rejection. A repeated one is read by its first value.
 * Two days that leave an empty range are both rejected.
 *
 * The filter of the address from before the quick filters were conditions of
 * their own is read as the quick filter it named, so a link from before says
 * the same thing.
 */
export function parseListConditions(
	raw: Readonly<Record<string, string | string[] | undefined>>,
): ParsedConditions {
	const rejected = new Set<ConditionName>();
	const read = <T>(
		name: ConditionName,
		schema: z.ZodType<T>,
	): T | undefined => {
		const text = firstValue(raw[name]);
		if (text === undefined || text === "") {
			return undefined;
		}
		const parsed = schema.safeParse(text);
		if (!parsed.success) {
			rejected.add(name);
			return undefined;
		}
		return parsed.data;
	};

	let after = read("after", conditionDaySchema) ?? null;
	let before = read("before", conditionDaySchema) ?? null;
	if (isEmptyRange(after, before)) {
		rejected.add("after");
		rejected.add("before");
		after = null;
		before = null;
	}
	const ticks: Record<(typeof QUICK_FILTERS)[number], boolean> = {
		unread: read("unread", conditionTickSchema) !== undefined,
		starred: read("starred", conditionTickSchema) !== undefined,
		important: read("important", conditionTickSchema) !== undefined,
		attachment: read("attachment", conditionTickSchema) !== undefined,
	};
	const legacy = LEGACY_FILTERS[firstValue(raw["filter"]) ?? ""];
	if (legacy !== undefined) {
		ticks[legacy] = true;
	}
	const conditions: ListConditions = {
		q: read("q", conditionTextSchema) ?? "",
		from: read("from", conditionTextSchema) ?? "",
		to: read("to", conditionTextSchema) ?? "",
		subject: read("subject", conditionTextSchema) ?? "",
		after,
		before,
		label: read("label", conditionLabelSchema) ?? null,
		folder: read("folder", conditionFolderSchema) ?? null,
		unread: ticks.unread,
		starred: ticks.starred,
		important: ticks.important,
		attachment: ticks.attachment,
		order: read("order", listOrderSchema) ?? "newest",
	};
	return {
		conditions,
		rejected: CONDITION_NAMES.filter((name) => rejected.has(name)),
	};
}
