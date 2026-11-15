import { useSyncExternalStore } from "react";
import type { TimeZone } from "@/features/time-zone/config/zones";
import { resolveTimeZone } from "@/features/time-zone/config/zones";
import { dayInZone } from "@/features/time-zone/format/day";

/** What makes the day worth reading again: the window comes back into view or into focus. */
function subscribe(onChange: () => void): () => void {
	document.addEventListener("visibilitychange", onChange);
	window.addEventListener("focus", onChange);
	return () => {
		document.removeEventListener("visibilitychange", onChange);
		window.removeEventListener("focus", onChange);
	};
}

/**
 * Today, as `YYYY-MM-DD`, in the person's zone. The server's answer is the
 * first paint, on the server and in the hydration, so the page the server
 * sends is the one the browser keeps; after it the browser's own clock takes
 * over and is read again when the window returns to the person, so a page left
 * open past midnight does not keep marking yesterday. The layout holding the
 * sidebar is not drawn again by a move between pages, which is why the server's
 * answer cannot be the only one.
 */
export function useToday(serverToday: string, timeZone: TimeZone): string {
	const zone = resolveTimeZone(timeZone);
	return useSyncExternalStore(
		subscribe,
		() => dayInZone(new Date(), zone),
		() => serverToday,
	);
}
