/**
 * Seeded generator for generated-input tests.
 *
 * Every case draws from its own stream, derived from a base seed and the case
 * number, so a failure message that prints both replays that one case alone.
 * The streams are deterministic: the same seed gives the same inputs on every
 * machine and run. Set `GENERATED_SEED` to a non-negative integer to explore
 * other inputs, for instance `GENERATED_SEED=$RANDOM bun test`; CI leaves it
 * unset and keeps the default. Every failure prints the seed in force, and
 * running again with that value replays the whole run.
 */

/** Seed every generated-input test uses unless `GENERATED_SEED` overrides it. */
export const DEFAULT_SEED = 20261112;

/** Source of generated values for one case. */
export interface Rng {
	/** Next float in `[0, 1)`. */
	next(): number;
	/** Integer in `[min, max]`, both included. */
	int(min: number, max: number): number;
	/** `true` with probability `p` (default one half). */
	chance(p?: number): boolean;
	/** One element of a non-empty list. */
	pick<T>(items: readonly T[]): T;
	/** `length` random bytes. */
	bytes(length: number): Uint8Array;
	/** `length` characters drawn from `alphabet`. */
	string(alphabet: string, length: number): string;
}

/** Mix two 32-bit integers into one well spread 32-bit state. */
function mix(a: number, b: number): number {
	let h = (a ^ Math.imul(b + 0x9e3779b9, 0x85ebca6b)) >>> 0;
	h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
	h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
	return (h ^ (h >>> 16)) >>> 0;
}

/**
 * Build the generator for `seed`, mulberry32 over a state mixed from the seed.
 * Not for cryptography: it exists to make test inputs reproducible.
 */
export function createRng(seed: number): Rng {
	let state = mix(seed >>> 0, 0x1234abcd);
	const next = (): number => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
	const int = (min: number, max: number): number =>
		min + Math.floor(next() * (max - min + 1));
	return {
		next,
		int,
		chance: (p = 0.5) => next() < p,
		pick: <T>(items: readonly T[]): T => {
			const item = items[int(0, items.length - 1)];
			if (item === undefined && items.length === 0) {
				throw new Error("pick from an empty list");
			}
			return item as T;
		},
		bytes: (length) => {
			const out = new Uint8Array(length);
			for (let i = 0; i < length; i++) {
				out[i] = int(0, 255);
			}
			return out;
		},
		string: (alphabet, length) => {
			const chars = Array.from(alphabet);
			let out = "";
			for (let i = 0; i < length; i++) {
				out += chars[int(0, chars.length - 1)];
			}
			return out;
		},
	};
}

/**
 * The seed in force: `GENERATED_SEED` when it is set, else the default. A
 * value that is not a non-negative integer throws instead of falling back, so
 * a mistyped seed cannot make a run look explored when it replayed the default.
 */
export function activeSeed(): number {
	const fromEnv = process.env["GENERATED_SEED"]?.trim();
	if (fromEnv === undefined || fromEnv === "") {
		return DEFAULT_SEED;
	}
	if (!/^\d+$/.test(fromEnv) || !Number.isSafeInteger(Number(fromEnv))) {
		throw new Error(
			`GENERATED_SEED must be a non-negative integer, got "${fromEnv}"`,
		);
	}
	return Number(fromEnv);
}

/**
 * Run `body` for `count` cases, each with its own generator.
 *
 * A throw from a case is rethrown with the label, the seed and the case number
 * in the message, and the original error as `cause`, so the failure can be
 * replayed by calling `replayCase` with the same three values.
 */
export async function runCases(
	label: string,
	count: number,
	body: (rng: Rng, index: number) => void | Promise<void>,
	seed: number = activeSeed(),
): Promise<void> {
	for (let index = 0; index < count; index++) {
		await replayCase(label, seed, index, body);
	}
}

/** Run the single case `index` of a run, with the failure message of `runCases`. */
export async function replayCase(
	label: string,
	seed: number,
	index: number,
	body: (rng: Rng, index: number) => void | Promise<void>,
): Promise<void> {
	try {
		await body(createRng(mix(seed, index)), index);
	} catch (error) {
		const detail = error instanceof Error ? error.message : String(error);
		throw new Error(
			`${label}: seed=${seed} case=${index} (rerun the suite with GENERATED_SEED=${seed}, or call replayCase): ${detail}`,
			{ cause: error },
		);
	}
}
