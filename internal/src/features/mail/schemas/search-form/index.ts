import * as z from "zod/mini";

import {
	isKeywordAtom,
	isLabelKeyword,
} from "@/features/mail/labels/keyword-codec";
import {
	CONDITION_TEXT_PATTERN,
	isConditionDay,
	type ListConditions,
	MAX_CONDITION_TEXT,
} from "@/features/mail/schemas/list-conditions-model";
import { MAILBOX_ID_PATTERN } from "@/lib/mail-paths";

/**
 * The rules of the fields of the search form, for the check the page makes
 * before it sends anything: the browser's own check is the first one, this is
 * the second, and the server reads the address again with the same rules
 * (`list-conditions`), which is the third and the real one.
 *
 * `zod/mini`: the form ships it. The limits and the patterns come from the
 * model of the conditions, so the two checks cannot drift apart.
 */

/**
 * Every message this schema can give, as a key of the `mail` namespace. The
 * form translates a message only when it is one of these.
 */
export const SEARCH_FORM_MESSAGES = [
	"conditionTooLong",
	"conditionInvalidText",
	"conditionInvalidDay",
	"conditionInvalidFolder",
	"conditionInvalidLabel",
	"conditionInvalidRange",
] as const;
export type SearchFormMessage = (typeof SEARCH_FORM_MESSAGES)[number];

/** Whether a field's message is one of the schema's keys. */
export function isSearchFormMessage(
	message: string,
): message is SearchFormMessage {
	return (SEARCH_FORM_MESSAGES as readonly string[]).includes(message);
}

/** A text condition: at most its length, with no control character in it. */
function text() {
	return z
		.string()
		.check(
			z.maxLength(MAX_CONDITION_TEXT, "conditionTooLong"),
			z.regex(CONDITION_TEXT_PATTERN, "conditionInvalidText"),
		);
}

/** A day condition: empty, or a day of the calendar. */
function day() {
	return z
		.string()
		.check(
			z.refine(
				(value) => value === "" || isConditionDay(value),
				"conditionInvalidDay",
			),
		);
}

/**
 * The fields of the search form, as the page reads them: the words, the
 * fields that narrow them and the days they are kept between. A folder and a
 * label are empty when they narrow nothing.
 */
export const searchFormSchema = z
	.object({
		q: text(),
		from: text(),
		to: text(),
		subject: text(),
		after: day(),
		before: day(),
		folder: z
			.string()
			.check(
				z.refine(
					(value) => value === "" || MAILBOX_ID_PATTERN.test(value),
					"conditionInvalidFolder",
				),
			),
		label: z
			.string()
			.check(
				z.refine(
					(value) =>
						value === "" ||
						(isKeywordAtom(value) && isLabelKeyword(value)),
					"conditionInvalidLabel",
				),
			),
	})
	.check(
		z.refine(
			(value) =>
				value.after === "" ||
				value.before === "" ||
				value.after <= value.before,
			"conditionInvalidRange",
		),
	);

/** What the form reads out of the page before it sends it. */
export interface SearchFormValues {
	q: string;
	from: string;
	to: string;
	subject: string;
	after: string;
	before: string;
	folder: string;
	label: string;
}

/**
 * The values of the form, read out of the form data. A field the form does
 * not hold is empty: the page sends what it has and the server refuses what
 * does not fit.
 */
export function searchFormValues(data: FormData): SearchFormValues {
	const textOf = (name: string) => {
		const value = data.get(name);
		return typeof value === "string" ? value : "";
	};
	return {
		q: textOf("q"),
		from: textOf("from"),
		to: textOf("to"),
		subject: textOf("subject"),
		after: textOf("after"),
		before: textOf("before"),
		folder: textOf("folder"),
		label: textOf("label"),
	};
}

/**
 * The conditions the form carries, as the address holds them: the words, the
 * fields that narrow them, the days they are kept between, the folder and the
 * label, and what the list was already narrowed by (the quick filters and the
 * order, which the form carries with it).
 *
 * A field that narrows nothing is empty and a day that narrows nothing is
 * none: the address of a search says what narrows the list and nothing else.
 */
export function searchFormConditions(data: FormData): ListConditions {
	const textOf = (name: string) => {
		const value = data.get(name);
		return typeof value === "string" ? value : "";
	};
	const noneIfEmpty = (name: string) => {
		const value = textOf(name);
		return value === "" ? null : value;
	};
	const order = textOf("order");
	return {
		q: textOf("q"),
		from: textOf("from"),
		to: textOf("to"),
		subject: textOf("subject"),
		after: noneIfEmpty("after"),
		before: noneIfEmpty("before"),
		label: noneIfEmpty("label"),
		folder: noneIfEmpty("folder"),
		unread: textOf("unread") === "1",
		starred: textOf("starred") === "1",
		important: textOf("important") === "1",
		attachment: textOf("attachment") === "1",
		order: order === "oldest" || order === "largest" ? order : "newest",
	};
}
