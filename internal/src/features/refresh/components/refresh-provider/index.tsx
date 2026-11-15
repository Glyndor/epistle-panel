"use client";

import { createContext, type ReactNode, useContext } from "react";

import {
	DEFAULT_REFRESH_PACE,
	type RefreshPace,
	refreshInterval,
} from "@/features/refresh/config/pace";

/**
 * The pace the lists of the page refresh at. It is set once, by the layout,
 * with the pace the server read from the cookie (or the operator's), and read
 * by the client components that poll. The browser never reads the cookie: it is
 * `HttpOnly`, and the pace arrives here as a prop.
 */
const RefreshContext = createContext<RefreshPace>(DEFAULT_REFRESH_PACE);

export function RefreshProvider({
	pace,
	children,
}: {
	pace: RefreshPace;
	children: ReactNode;
}) {
	return (
		<RefreshContext.Provider value={pace}>
			{children}
		</RefreshContext.Provider>
	);
}

/**
 * The interval a list refreshes at, in milliseconds, given the one it has at
 * the normal pace. Without a provider the pace is `normal`, which is what the
 * panel did before the person could choose, so a list is never left without a
 * refresh.
 */
export function useRefreshInterval(baseMs: number): number {
	return refreshInterval(baseMs, useContext(RefreshContext));
}
