"use client";

import { createContext, type ReactNode, useContext } from "react";

import {
	DEFAULT_TIME_ZONE,
	resolveTimeZone,
	type TimeZone,
} from "@/features/time-zone/config/zones";

/**
 * The zone every date of the page is printed in. It is set once, by the
 * layout, with the zone the server read from the cookie (or the operator's),
 * and read by the client components that print a date. The browser never reads
 * the cookie: it is `HttpOnly`, and the zone arrives here as a prop.
 */
const TimeZoneContext = createContext<TimeZone>(DEFAULT_TIME_ZONE);

/**
 * The frame of the panel's pages with the zone in it. The children are the
 * server's, and they are rendered on the server; what the zone reaches is the
 * client components below.
 */
export function TimeZoneProvider({
	timeZone,
	children,
}: {
	timeZone: TimeZone;
	children: ReactNode;
}) {
	return (
		<TimeZoneContext.Provider value={timeZone}>
			{children}
		</TimeZoneContext.Provider>
	);
}

/**
 * The zone this request prints its dates in. Without a provider it is `UTC`,
 * which is what the panel printed before the person could choose. A zone this
 * browser does not know is `UTC` too: the browser cannot print it, and a date
 * that throws is worse than a date in the wrong clock.
 */
export function useTimeZone(): TimeZone {
	return resolveTimeZone(useContext(TimeZoneContext));
}
