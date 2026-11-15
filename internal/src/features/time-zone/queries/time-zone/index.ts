import "server-only";

import { cookies } from "next/headers";

import {
	parseTimeZone,
	TIME_ZONE_COOKIE,
	type TimeZone,
} from "@/features/time-zone/config/zones";
import { readOperatorTimeZone } from "@/lib/config/time-zone";

/**
 * The zone this request chose, from the `time-zone` cookie. The cookie comes
 * from the browser, so its value is never trusted: anything that is not
 * exactly a zone reads as `UTC`, and only the parsed zone, never the cookie's
 * text, reaches the page.
 */
export async function readTimeZonePreference(): Promise<TimeZone> {
	return parseTimeZone((await cookies()).get(TIME_ZONE_COOKIE)?.value);
}

/**
 * The zone every date of this request is printed in: the operator's when they
 * fixed one, and the person's otherwise. The operator's zone wins over the
 * cookie, the same way the mode of the remote images does.
 */
export async function readEffectiveTimeZone(): Promise<TimeZone> {
	const operatorZone = readOperatorTimeZone();
	if (operatorZone !== null) {
		return operatorZone;
	}
	return readTimeZonePreference();
}
