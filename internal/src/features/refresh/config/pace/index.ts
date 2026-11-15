/**
 * How fast the panel's lists refresh while a tab is in view: a closed list, and
 * never `off`, because a page left open and visible keeps the session alive by
 * refreshing its lists (the idle timeout counts that refresh as use).
 *
 * - `normal` is the interval each list has always had;
 * - `slow` is twice that;
 * - `fast` is half of it, but never below {@link MIN_FAST_REFRESH_MS}.
 */
export const REFRESH_PACES = ["normal", "slow", "fast"] as const;
export type RefreshPace = (typeof REFRESH_PACES)[number];

export const DEFAULT_REFRESH_PACE: RefreshPace = "normal";

export const REFRESH_COOKIE = "refresh";
export const REFRESH_COOKIE_PATH = "/app";

/** Shortest interval `fast` reaches, in milliseconds: a list never polls faster than this. */
export const MIN_FAST_REFRESH_MS = 15_000;

/** What each pace multiplies an interval by. */
const FACTORS: Readonly<Record<RefreshPace, number>> = {
	normal: 1,
	slow: 2,
	fast: 0.5,
};

export function isRefreshPace(value: unknown): value is RefreshPace {
	return REFRESH_PACES.some((pace) => pace === value);
}

/** The pace for a value that may come from a cookie: anything off the list is `normal`. */
export function parseRefreshPace(value: unknown): RefreshPace {
	return isRefreshPace(value) ? value : DEFAULT_REFRESH_PACE;
}

/**
 * The interval a list refreshes at under `pace`, from the interval it has at
 * `normal`. This is the one function every refreshing list goes through, so the
 * keepalive of the idle timeout always runs on the effective interval and no
 * list can end up with none.
 */
export function refreshInterval(baseMs: number, pace: RefreshPace): number {
	const scaled = baseMs * FACTORS[pace];
	return pace === "fast" ? Math.max(scaled, MIN_FAST_REFRESH_MS) : scaled;
}
