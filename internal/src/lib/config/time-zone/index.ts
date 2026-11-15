import "server-only";

import { isTimeZone, type TimeZone } from "@/features/time-zone/config/zones";

import { ConfigError } from "../config-error";

export const TIME_ZONE_VARIABLE = "EPISTLE_PANEL_TIME_ZONE";

/**
 * The zone the operator fixed for everyone, or `null` when they fixed none.
 * A value that is not a zone of the list stops the server: a panel that kept
 * running would print every date in a clock nobody chose. The error names the
 * variable and never its value.
 */
export function readOperatorTimeZone(): TimeZone | null {
	const value = (process.env[TIME_ZONE_VARIABLE] ?? "").trim();
	if (value === "") {
		return null;
	}
	if (!isTimeZone(value)) {
		throw new ConfigError(
			`${TIME_ZONE_VARIABLE} is set to a time zone the panel does not know`,
		);
	}
	return value;
}
