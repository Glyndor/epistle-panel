import type { DateGroup } from "@/features/mail/format/date-group";

/** What a row prints of its date: the time of day, or the day of the month. */
export type RowDatePart = "time" | "day";

/** What this asks of a date formatter. next-intl's `useFormatter()` satisfies it, and so does a test stand-in. */
interface RowDateFormatter {
	dateTime(
		value: Date,
		options:
			| { hour: "numeric"; minute: "2-digit"; timeZone: "UTC" }
			| { month: "short"; day: "numeric"; timeZone: "UTC" },
	): string;
}

/**
 * The part of its date a row prints under a heading of `kind`. The heading
 * already says the day of a message of today or of yesterday, so the row says
 * the hour; under any other heading the row says the day, and the heading the
 * month and the year when they matter.
 */
export function rowDatePart(kind: DateGroup["kind"]): RowDatePart {
	return kind === "today" || kind === "yesterday" ? "time" : "day";
}

/**
 * A message's date as its row prints it, or an empty string when the server's
 * value is not a date. In UTC, like the headings the rows stand under, so the
 * server render and the browser agree. The whole date and time is the `time`
 * element's own value and what the reader shows.
 */
export function formatRowDate(
	format: RowDateFormatter,
	value: string,
	part: RowDatePart,
): string {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		return "";
	}
	return part === "time"
		? format.dateTime(date, {
				hour: "numeric",
				minute: "2-digit",
				timeZone: "UTC",
			})
		: format.dateTime(date, {
				month: "short",
				day: "numeric",
				timeZone: "UTC",
			});
}
