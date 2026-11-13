/** What this asks of a date formatter. next-intl's `useFormatter()` satisfies it, and so does a test stand-in. */
interface DateOptions {
	dateStyle: "medium";
	timeStyle?: "short";
	timeZone: "UTC";
}
interface DateFormatter {
	dateTime(value: Date, options: DateOptions): string;
}

/**
 * A message's date for display, or an empty string when the server's value is
 * not a date. Printed in UTC, like the delivery log, so the server render and
 * the browser agree and nothing shifts on hydration.
 */
export function formatReceivedAt(
	format: DateFormatter,
	value: string,
	withTime = true,
): string {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		return "";
	}
	return withTime
		? format.dateTime(date, {
				dateStyle: "medium",
				timeStyle: "short",
				timeZone: "UTC",
			})
		: format.dateTime(date, { dateStyle: "medium", timeZone: "UTC" });
}
