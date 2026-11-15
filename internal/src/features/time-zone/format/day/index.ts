import type { TimeZone } from "@/features/time-zone/config/zones";

/**
 * The day an instant falls on, as `YYYY-MM-DD`, in a zone. It is the wall
 * clock of that zone, not the one of Greenwich: a message that arrives at two
 * in the morning is still the day before for whoever is behind Greenwich.
 */
export function dayInZone(instant: Date, timeZone: TimeZone): string {
	const parts = dayFormatter(timeZone).formatToParts(instant);
	const read = (type: Intl.DateTimeFormatPartTypes) =>
		parts.find((part) => part.type === type)?.value ?? "";
	return `${read("year")}-${read("month")}-${read("day")}`;
}

/** Days since the epoch of a `YYYY-MM-DD` day, or `null` when it is not one. */
export function dayNumber(day: string): number | null {
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

const DAY_MS = 86_400_000;
const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** One formatter per zone: the day of an instant is asked for once per row. */
const formatters = new Map<string, Intl.DateTimeFormat>();

function dayFormatter(timeZone: TimeZone): Intl.DateTimeFormat {
	const known = formatters.get(timeZone);
	if (known !== undefined) {
		return known;
	}
	const made = new Intl.DateTimeFormat("en-US", {
		timeZone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	});
	formatters.set(timeZone, made);
	return made;
}
