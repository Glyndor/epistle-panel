import type { TimeZone } from "@/features/time-zone/config/zones";

/**
 * How the page writes a moment: in the zone of the person, and with its name.
 * The zone is given, not read, because the server renders the first paint and
 * the browser takes it over: a clock of the browser's own would differ between
 * the two and the text would not match on hydration.
 */
export function momentFormat(timeZone: TimeZone) {
	return {
		year: "numeric",
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
		timeZone,
		timeZoneName: "short",
	} as const satisfies Intl.DateTimeFormatOptions;
}

/** The date of an epoch-seconds value, as the API reports times. */
export function fromEpochSeconds(seconds: number): Date {
	return new Date(seconds * 1000);
}
