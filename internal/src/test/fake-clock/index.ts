import { jest } from "bun:test";

// Taken at load, before any test fakes the timers: the loop below needs a
// real turn of the event loop, and `Bun.sleep` and the global timers are faked.
const realSetImmediate = globalThis.setImmediate;
const nextTurn = () =>
	new Promise<void>((resolve) => realSetImmediate(resolve));

const realAbortTimeout = AbortSignal.timeout;

/** Instant the fake clock starts at, in milliseconds since the epoch. */
export const FAKE_CLOCK_START = 1_800_000_000_000;

/** How a unit of work ended, and how much fake time it took. */
export interface Timed<T> {
	/** The resolved value, when the work resolved. */
	value?: T;
	/** The rejection, when the work rejected (a redirect signal, for one). */
	error?: unknown;
	/** Fake milliseconds between the start and the end of the work. */
	elapsedMs: number;
}

/**
 * Freeze `Date.now` and the timers at {@link FAKE_CLOCK_START}. Time then
 * moves only through {@link timeIt} or `jest.advanceTimersByTime`, so a test
 * about a waiting floor asserts exact milliseconds and never races the real
 * clock. Pair it with {@link useRealClock} in `afterEach`.
 *
 * `AbortSignal.timeout` is made inert too: the fake clock counts its timer, so
 * a request's 30 s budget would be the next timer to fire while the code under
 * test is still between two real awaits, and {@link timeIt} would jump over
 * the wait the test is about.
 */
export function useFakeClock(): void {
	jest.useFakeTimers({ now: FAKE_CLOCK_START });
	AbortSignal.timeout = () => new AbortController().signal;
}

/** Give the real clock and timers back. */
export function useRealClock(): void {
	jest.useRealTimers();
	AbortSignal.timeout = realAbortTimeout;
}

/**
 * Run `work` to the end. Between turns of the real event loop, which let the
 * real asynchronous work (the crypto calls, the stubbed fetch) finish, the
 * fake clock jumps to the next pending timer and fires it. Fake time therefore
 * passes only by waiting on a timer: work that waits on none takes 0 ms, and a
 * wait of 300 ms takes exactly 300 however slow the machine is.
 */
export async function timeIt<T>(work: () => Promise<T>): Promise<Timed<T>> {
	const started = Date.now();
	const result: Timed<T> = { elapsedMs: 0 };
	let finished = false;
	const running = work().then(
		(value) => {
			result.value = value;
			finished = true;
		},
		(error: unknown) => {
			result.error = error;
			finished = true;
		},
	);
	while (!finished) {
		await nextTurn();
		if (!finished && jest.getTimerCount() > 0) {
			jest.advanceTimersToNextTimer();
		}
	}
	await running;
	result.elapsedMs = Date.now() - started;
	return result;
}
