/**
 * The heading a message sits under in the list. The list prints its dates in
 * UTC, so the groups are days of UTC too, counted back from the day the server
 * read the list: the server render and the browser agree, and a tab left open
 * regroups when the list is read again.
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

const DAY_MS = 86_400_000;
const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** The day a server answer is from, as `YYYY-MM-DD` in UTC. */
export function utcDay(now: Date): string {
	return now.toISOString().slice(0, 10);
}

/** Days since the epoch of a `YYYY-MM-DD` day, or `null` when it is not one. */
function dayNumber(day: string): number | null {
	const match = ISO_DAY.exec(day);
	if (match === null) {
		return null;
	}
	const [year, month, date] = [
		Number(match[1]),
		Number(match[2]),
		Number(match[3]),
	];
	const time = Date.UTC(year, month - 1, date);
	const back = new Date(time);
	// `Date.UTC` rolls 2026-02-31 over into March: that is not a day.
	return back.getUTCFullYear() === year &&
		back.getUTCMonth() === month - 1 &&
		back.getUTCDate() === date
		? time / DAY_MS
		: null;
}

/**
 * The group of a message received at `receivedAt`, seen on the UTC day
 * `today`. A message dated after today (a clock that runs ahead) is today's.
 */
export function dateGroup(receivedAt: string, today: string): DateGroup {
	const received = new Date(receivedAt);
	const todayNumber = dayNumber(today);
	if (Number.isNaN(received.getTime()) || todayNumber === null) {
		return { kind: "unknown" };
	}
	const back = todayNumber - Math.floor(received.getTime() / DAY_MS);
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
		year: received.getUTCFullYear(),
		month: received.getUTCMonth() + 1,
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
): Array<{ readonly group: DateGroup; readonly rows: T[] }> {
	const runs: Array<{ group: DateGroup; rows: T[] }> = [];
	for (const row of rows) {
		const group = dateGroup(row.receivedAt, today);
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
