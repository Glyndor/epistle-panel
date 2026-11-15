import {
	isConditionDay,
	type ListConditions,
} from "@/features/mail/schemas/list-conditions-model";

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** The hour a calendar date is held at: noon is never skipped by a clock change, so the date cannot slide to the day before or after. */
const HELD_AT = 12;

/**
 * The calendar's date for a day written `YYYY-MM-DD`, or `undefined` when the
 * text is not a day the conditions of a list accept. The date is the one on
 * the wall of whoever reads it, held at noon: the calendar counts days with
 * the dates of the runtime it runs in, and a day built from its numbers reads
 * back as the same numbers in every zone (the server draws it in its own, the
 * browser in the person's).
 */
export function dayToDate(day: string): Date | undefined {
	const match = ISO_DAY.exec(day);
	if (match === null || !isConditionDay(day)) {
		return undefined;
	}
	return new Date(
		Number(match[1]),
		Number(match[2]) - 1,
		Number(match[3]),
		HELD_AT,
	);
}

/** The day, as `YYYY-MM-DD`, a calendar's date stands for: the numbers on its own wall, as `dayToDate` wrote them. */
export function dateToDay(date: Date): string {
	const year = String(date.getFullYear()).padStart(4, "0");
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

/**
 * The day the list is narrowed to, when it is narrowed to exactly one: both
 * ends are the same day. A range of several days, or only one end, is not a
 * day the calendar can mark, so it marks none.
 */
export function selectedDay(
	conditions: Pick<ListConditions, "after" | "before">,
): string | null {
	const { after, before } = conditions;
	return after !== null && after === before && isConditionDay(after)
		? after
		: null;
}
