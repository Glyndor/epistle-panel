/**
 * How the page writes a moment. UTC and with its name, because the server
 * renders the first paint and the browser takes it over: a local zone would
 * differ between the two and the text would not match on hydration.
 */
export const MOMENT_FORMAT = {
	year: "numeric",
	month: "short",
	day: "numeric",
	hour: "2-digit",
	minute: "2-digit",
	timeZone: "UTC",
	timeZoneName: "short",
} as const satisfies Intl.DateTimeFormatOptions;

/** The date of an epoch-seconds value, as the API reports times. */
export function fromEpochSeconds(seconds: number): Date {
	return new Date(seconds * 1000);
}
