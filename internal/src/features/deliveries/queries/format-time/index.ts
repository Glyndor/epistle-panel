import type { TimeZone } from "@/features/time-zone/config/zones";

/**
 * An epoch second as `YYYY-MM-DD HH:MM:SS` in the zone of the person. The
 * zone is given, not read: the server renders the first paint and the browser
 * takes it over, and a clock of the browser's own would differ between the
 * two. A value that is not a date prints as `-`.
 */
export function formatTime(epochSeconds: number, timeZone: TimeZone): string {
	const date = new Date(epochSeconds * 1000);
	if (Number.isNaN(date.getTime())) {
		return "-";
	}
	const parts = formatter(timeZone).formatToParts(date);
	const read = (type: Intl.DateTimeFormatPartTypes) =>
		parts.find((part) => part.type === type)?.value ?? "";
	return `${read("year")}-${read("month")}-${read("day")} ${read("hour")}:${read("minute")}:${read("second")}`;
}

/** One formatter per zone: the time of every record of the log is asked for. */
const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: TimeZone): Intl.DateTimeFormat {
	const known = formatters.get(timeZone);
	if (known !== undefined) {
		return known;
	}
	const made = new Intl.DateTimeFormat("en-US", {
		timeZone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		hourCycle: "h23",
	});
	formatters.set(timeZone, made);
	return made;
}
