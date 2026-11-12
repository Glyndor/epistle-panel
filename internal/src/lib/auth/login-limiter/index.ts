/**
 * Login attempt limiter, checked before any call to the Epistle API.
 *
 * Three limits apply to every attempt:
 *
 * - Per account name, one chain at a time. The first {@link FREE_ATTEMPTS}
 *   attempts pass, then each further attempt locks the name for twice as long as
 *   the one before ({@link BASE_LOCK_MS} doubling). A chain starts with the
 *   first attempt and ends {@link MAX_LOCK_MS} later: no lock reaches past that
 *   point, and once it has passed the name starts again from a clean count. A
 *   lock is never renewed, so a request repeated at every expiry cannot keep
 *   a name shut longer than one chain; the right password is refused while a
 *   lock holds, which is the control, and the lock ends. A success clears the
 *   name. At most about a dozen attempts per name pass in each chain.
 * - Global, over {@link GLOBAL_WINDOW_MS}: at most {@link GLOBAL_MAX_FAILURES}
 *   attempts that the API answered with a failure, so rotating names does not
 *   escape the per-name limit. Only failures count, because the outcome is
 *   known once the API answers. A name that already signed in during this
 *   process (up to {@link KNOWN_GOOD_MS} ago) is not held by this ceiling.
 * - Concurrency: at most {@link MAX_IN_FLIGHT} attempts wait on the API at
 *   once, for every name, so a burst never turns into a burst of password
 *   hashes. A refused attempt never reaches the API.
 *
 * What an attacker can still do: sustain {@link GLOBAL_MAX_FAILURES} failing
 * attempts per window to hold the ceiling shut for any name that has not signed
 * in during this process, for example the first sign-in after a restart, while
 * the flood lasts. Names that signed in before keep their access, except for
 * their own lock and the concurrency cap, which only refuses an attempt that
 * arrives while all slots are busy. The attacker can also lock any single name
 * for the rest of its chain, up to {@link MAX_LOCK_MS}, by failing it enough
 * times; the lock ends on its own.
 *
 * Only the account name keys the limiter. The panel does not read forwarded
 * client-address headers, since the client controls them unless a trusted proxy
 * rewrites them; the API's own limiter currently sees a single address for all
 * panel traffic.
 *
 * An attempt is counted against its name when it is admitted, not when it
 * fails, so a burst of parallel requests cannot all pass before the first
 * failure is recorded. State is in memory, per process, and sits on
 * `globalThis` for the same reason as the revocation set.
 */

/** Attempts per account name before backoff starts. */
export const FREE_ATTEMPTS = 3;
/** Lock after the first attempt past the free ones, in milliseconds. */
export const BASE_LOCK_MS = 2_000;
/**
 * Length of one chain of attempts for a name, in milliseconds. It is also the
 * longest time a chain can keep a name locked, because no lock ends later than
 * the chain does.
 */
export const MAX_LOCK_MS = 15 * 60_000;
/** Length of the global counting window, in milliseconds. */
export const GLOBAL_WINDOW_MS = 60_000;
/** Failed attempts per global window before unknown names are refused. */
export const GLOBAL_MAX_FAILURES = 60;
/** Attempts waiting on the API at the same time, across all names. */
export const MAX_IN_FLIGHT = 8;
/** How long a name that signed in is exempt from the global ceiling. */
export const KNOWN_GOOD_MS = 8 * 60 * 60_000;
/** Account names tracked at once; the oldest is dropped when full. */
export const MAX_TRACKED_NAMES = 10_000;
/** Names exempt from the global ceiling at once; the oldest is dropped. */
export const MAX_KNOWN_GOOD_NAMES = 1_000;
/** Longest name that is tracked; longer names share a truncated key. */
const MAX_KEY_LENGTH = 256;

interface NameRecord {
	attempts: number;
	chainStart: number;
	lockedUntil: number;
}

interface LimiterState {
	names: Map<string, NameRecord>;
	knownGood: Map<string, number>;
	windowStart: number;
	windowFailures: number;
	inFlight: number;
}

const STATE = Symbol.for("epistle-panel.login-limiter");

function state(): LimiterState {
	const holder = globalThis as unknown as Record<
		symbol,
		LimiterState | undefined
	>;
	holder[STATE] ??= {
		names: new Map(),
		knownGood: new Map(),
		windowStart: 0,
		windowFailures: 0,
		inFlight: 0,
	};
	return holder[STATE];
}

/** How the API answered an admitted attempt, reported through `settle`. */
export type Outcome =
	/** The credentials were valid for an admin. */
	| "success"
	/** The API answered that the credentials are wrong or not an admin's. */
	| "failure"
	/** No answer: the call failed, so nothing is learned about the name. */
	| "error";

/** Outcome of {@link admitAttempt}. */
export type Admission =
	| {
			allowed: true;
			/**
			 * Report the outcome and free the attempt's slot. Only the first call
			 * counts, so a caller can also call it from a `finally`.
			 */
			settle: (outcome: Outcome, now?: number) => void;
	  }
	| { allowed: false; retryAfterMs: number };

function keyOf(name: string): string {
	return name.normalize("NFKC").trim().toLowerCase().slice(0, MAX_KEY_LENGTH);
}

function lockFor(attempts: number): number {
	const doublings = attempts - FREE_ATTEMPTS - 1;
	return BASE_LOCK_MS * 2 ** Math.min(doublings, 30);
}

function rollWindow(limiter: LimiterState, now: number): void {
	if (now - limiter.windowStart >= GLOBAL_WINDOW_MS) {
		limiter.windowStart = now;
		limiter.windowFailures = 0;
	}
}

function isKnownGood(limiter: LimiterState, key: string, now: number): boolean {
	const until = limiter.knownGood.get(key);
	return until !== undefined && until > now;
}

/**
 * Decide whether a login attempt for `name` may reach the API, and count it if
 * so. A denied attempt is not counted, so retrying during a lock does not
 * lengthen it. The caller must call `settle` on an allowed attempt once the
 * API has answered. Pass `now` (milliseconds) only from tests.
 */
export function admitAttempt(
	name: string,
	now: number = Date.now(),
): Admission {
	const limiter = state();
	const key = keyOf(name);

	if (limiter.inFlight >= MAX_IN_FLIGHT) {
		return { allowed: false, retryAfterMs: BASE_LOCK_MS };
	}
	rollWindow(limiter, now);
	if (
		limiter.windowFailures >= GLOBAL_MAX_FAILURES &&
		!isKnownGood(limiter, key, now)
	) {
		return {
			allowed: false,
			retryAfterMs: limiter.windowStart + GLOBAL_WINDOW_MS - now,
		};
	}

	const known = limiter.names.get(key);
	const record: NameRecord =
		known && known.chainStart + MAX_LOCK_MS > now
			? known
			: { attempts: 0, chainStart: now, lockedUntil: 0 };
	if (record.lockedUntil > now) {
		return { allowed: false, retryAfterMs: record.lockedUntil - now };
	}

	record.attempts += 1;
	if (record.attempts > FREE_ATTEMPTS) {
		record.lockedUntil = Math.min(
			now + lockFor(record.attempts),
			record.chainStart + MAX_LOCK_MS,
		);
	}
	limiter.inFlight += 1;

	limiter.names.delete(key);
	if (limiter.names.size >= MAX_TRACKED_NAMES) {
		forgetStale(limiter.names, now);
	}
	limiter.names.set(key, record);

	let settled = false;
	return {
		allowed: true,
		settle: (outcome, at = Date.now()) => {
			if (settled) {
				return;
			}
			settled = true;
			settleAttempt(key, outcome, at);
		},
	};
}

function settleAttempt(key: string, outcome: Outcome, now: number): void {
	const limiter = state();
	limiter.inFlight = Math.max(0, limiter.inFlight - 1);
	if (outcome === "failure") {
		rollWindow(limiter, now);
		limiter.windowFailures += 1;
	} else if (outcome === "success") {
		limiter.names.delete(key);
		limiter.knownGood.delete(key);
		if (limiter.knownGood.size >= MAX_KNOWN_GOOD_NAMES) {
			const oldest = limiter.knownGood.keys().next();
			if (!oldest.done) {
				limiter.knownGood.delete(oldest.value);
			}
		}
		limiter.knownGood.set(key, now + KNOWN_GOOD_MS);
	}
}

/** Drop records whose chain is over, then the oldest one if still full. */
function forgetStale(names: Map<string, NameRecord>, now: number): void {
	for (const [key, record] of names) {
		if (record.chainStart + MAX_LOCK_MS <= now) {
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

/** Number of names tracked, for tests of the bound. */
export function trackedNames(): number {
	return state().names.size;
}

/** Attempts currently waiting on the API, for tests of the cap. */
export function attemptsInFlight(): number {
	return state().inFlight;
}

/** Forget all state. Tests only; nothing in the app calls it. */
export function resetLoginLimiter(): void {
	const limiter = state();
	limiter.names.clear();
	limiter.knownGood.clear();
	limiter.windowStart = 0;
	limiter.windowFailures = 0;
	limiter.inFlight = 0;
}
