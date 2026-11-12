/**
 * Login attempt limiter, checked before any call to the Epistle API.
 *
 * Two limits apply to every attempt:
 *
 * - Per account name: the first {@link FREE_ATTEMPTS} attempts pass, then each
 *   further attempt locks the name for twice as long as the one before
 *   ({@link BASE_LOCK_MS} doubling up to {@link MAX_LOCK_MS}). A success clears
 *   the name.
 * - Global: at most {@link GLOBAL_MAX_ATTEMPTS} attempts per
 *   {@link GLOBAL_WINDOW_MS} across all names, so rotating names does not
 *   escape the per-name limit. The ceiling also locks the real admin out while
 *   it is hit, the same trade the API's shared limiter makes today.
 *
 * Only the account name keys the limiter. The panel does not read forwarded
 * client-address headers, since the client controls them unless a trusted proxy
 * rewrites them; the API's own limiter currently sees a single address for all
 * panel traffic.
 *
 * An attempt is counted when it is admitted, not when it fails, so a burst of
 * parallel requests cannot all pass before the first failure is recorded; a
 * success gives the count back. State is in memory, per process, and sits on
 * `globalThis` for the same reason as the revocation set.
 */

/** Attempts per account name before backoff starts. */
export const FREE_ATTEMPTS = 3;
/** Lock after the first attempt past the free ones, in milliseconds. */
export const BASE_LOCK_MS = 2_000;
/** Longest single lock, in milliseconds. */
export const MAX_LOCK_MS = 15 * 60_000;
/** How long a name is remembered after its last attempt, in milliseconds. */
export const IDLE_FORGET_MS = 15 * 60_000;
/** Length of the global counting window, in milliseconds. */
export const GLOBAL_WINDOW_MS = 60_000;
/** Attempts admitted per global window, across all names. */
export const GLOBAL_MAX_ATTEMPTS = 60;
/** Account names tracked at once; the oldest is dropped when full. */
export const MAX_TRACKED_NAMES = 10_000;
/** Longest name that is tracked; longer names share a truncated key. */
const MAX_KEY_LENGTH = 256;

interface NameRecord {
	attempts: number;
	lockedUntil: number;
	forgetAt: number;
}

interface LimiterState {
	names: Map<string, NameRecord>;
	windowStart: number;
	windowAttempts: number;
}

const STATE = Symbol.for("epistle-panel.login-limiter");

function state(): LimiterState {
	const holder = globalThis as unknown as Record<
		symbol,
		LimiterState | undefined
	>;
	holder[STATE] ??= { names: new Map(), windowStart: 0, windowAttempts: 0 };
	return holder[STATE];
}

/** Outcome of {@link admitAttempt}. */
export type Admission =
	| { allowed: true }
	| { allowed: false; retryAfterMs: number };

function keyOf(name: string): string {
	return name.normalize("NFKC").trim().toLowerCase().slice(0, MAX_KEY_LENGTH);
}

function lockFor(attempts: number): number {
	const doublings = attempts - FREE_ATTEMPTS - 1;
	return Math.min(BASE_LOCK_MS * 2 ** doublings, MAX_LOCK_MS);
}

/**
 * Decide whether a login attempt for `name` may reach the API, and count it if
 * so. A denied attempt is not counted, so retrying during a lock does not
 * lengthen it. Pass `now` (milliseconds) only from tests.
 */
export function admitAttempt(
	name: string,
	now: number = Date.now(),
): Admission {
	const limiter = state();

	if (now - limiter.windowStart >= GLOBAL_WINDOW_MS) {
		limiter.windowStart = now;
		limiter.windowAttempts = 0;
	}
	if (limiter.windowAttempts >= GLOBAL_MAX_ATTEMPTS) {
		return {
			allowed: false,
			retryAfterMs: limiter.windowStart + GLOBAL_WINDOW_MS - now,
		};
	}

	const key = keyOf(name);
	const known = limiter.names.get(key);
	const record =
		known && known.forgetAt > now
			? known
			: { attempts: 0, lockedUntil: 0, forgetAt: 0 };
	if (record.lockedUntil > now) {
		return { allowed: false, retryAfterMs: record.lockedUntil - now };
	}

	record.attempts += 1;
	if (record.attempts > FREE_ATTEMPTS) {
		record.lockedUntil = now + lockFor(record.attempts);
	}
	record.forgetAt = Math.max(record.lockedUntil, now) + IDLE_FORGET_MS;
	limiter.windowAttempts += 1;

	limiter.names.delete(key);
	if (limiter.names.size >= MAX_TRACKED_NAMES) {
		forgetStale(limiter.names, now);
	}
	limiter.names.set(key, record);
	return { allowed: true };
}

/** Drop expired records, then the oldest one if the map is still full. */
function forgetStale(names: Map<string, NameRecord>, now: number): void {
	for (const [key, record] of names) {
		if (record.forgetAt <= now) {
			names.delete(key);
		}
	}
	if (names.size >= MAX_TRACKED_NAMES) {
		const oldest = names.keys().next();
		if (!oldest.done) {
			names.delete(oldest.value);
		}
	}
}

/** Clear `name` after a successful login and give its attempt back to the window. */
export function recordSuccess(name: string): void {
	const limiter = state();
	limiter.names.delete(keyOf(name));
	limiter.windowAttempts = Math.max(0, limiter.windowAttempts - 1);
}

/** Number of names tracked, for tests of the bound. */
export function trackedNames(): number {
	return state().names.size;
}

/** Forget all state. Tests only; nothing in the app calls it. */
export function resetLoginLimiter(): void {
	const limiter = state();
	limiter.names.clear();
	limiter.windowStart = 0;
	limiter.windowAttempts = 0;
}
