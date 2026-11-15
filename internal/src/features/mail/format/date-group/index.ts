import type { TimeZone } from "@/features/time-zone/config/zones";
import { dayInZone, dayNumber } from "@/features/time-zone/format/day";

/**
 * The heading a message sits under in the list. The list prints its dates in
 * the zone of the person, so the groups are days of that zone too, counted
 * back from the day the server read the list: the server render and the
 * browser group alike, and a tab left open regroups when the list is read
 * again.
 */
export type DateGroup =
	| { readonly kind: "today" }
	| { readonly kind: "yesterday" }
	/** Two to six days back. */
	| { readonly kind: "week" }
	/** Older: the calendar month it arrived in. `month` is 1 to 12. */
	| { readonly kind: "month"; readonly year: number; readonly month: number }
	/** The server's value is not a date. */
	| { readonly kind: "unknown" };

/**
 * The group of a message received at `receivedAt`, seen on the day `today` of
 * the zone. A message dated after today (a clock that runs ahead) is today's.
 */
export function dateGroup(
	receivedAt: string,
	today: string,
	timeZone: TimeZone,
): DateGroup {
	const received = new Date(receivedAt);
	const todayNumber = dayNumber(today);
	if (Number.isNaN(received.getTime()) || todayNumber === null) {
		return { kind: "unknown" };
	}
	const day = dayInZone(received, timeZone);
	const receivedNumber = dayNumber(day);
	if (receivedNumber === null) {
		return { kind: "unknown" };
	}
	const back = todayNumber - receivedNumber;
	if (back <= 0) {
		return { kind: "today" };
	}
	if (back === 1) {
		return { kind: "yesterday" };
	}
	if (back <= 6) {
		return { kind: "week" };
	}
	return {
		kind: "month",
		year: Number(day.slice(0, 4)),
		month: Number(day.slice(5, 7)),
	};
}

/** A key that is the same for two messages of one group and differs between groups. */
export function dateGroupKey(group: DateGroup): string {
	return group.kind === "month"
		? `month-${group.year}-${String(group.month).padStart(2, "0")}`
		: group.kind;
}

/**
 * Split rows that are already in the list's order into runs of one group.
 * The order is kept as it came: a row out of order starts a new run and is
 * never moved, so the list on screen is the list the server gave.
 */
export function groupByDate<T extends { readonly receivedAt: string }>(
	rows: readonly T[],
	today: string,
	timeZone: TimeZone,
): Array<{ readonly group: DateGroup; readonly rows: T[] }> {
	const runs: Array<{ group: DateGroup; rows: T[] }> = [];
	for (const row of rows) {
		const group = dateGroup(row.receivedAt, today, timeZone);
		const last = runs.at(-1);
		if (
			last !== undefined &&
			dateGroupKey(last.group) === dateGroupKey(group)
		) {
			last.rows.push(row);
		} else {
			runs.push({ group, rows: [row] });
		}
	}
	return runs;
}
