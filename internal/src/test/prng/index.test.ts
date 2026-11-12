import { describe, expect, it } from "bun:test";

import { activeSeed, createRng, DEFAULT_SEED, replayCase, runCases } from ".";

describe("createRng", () => {
	it("gives the same stream for the same seed and a different one otherwise", () => {
		const draw = (seed: number) => {
			const rng = createRng(seed);
			return Array.from({ length: 8 }, () => rng.next());
		};
		expect(draw(1)).toEqual(draw(1));
		expect(draw(1)).not.toEqual(draw(2));
	});

	it("keeps floats in [0, 1) and integers inside their bounds", () => {
		const rng = createRng(7);
		const seen = new Set<number>();
		for (let i = 0; i < 2000; i++) {
			const f = rng.next();
			expect(f).toBeGreaterThanOrEqual(0);
			expect(f).toBeLessThan(1);
			seen.add(rng.int(3, 6));
		}
		expect([...seen].sort()).toEqual([3, 4, 5, 6]);
	});

	it("picks, builds strings and bytes from what it is given", () => {
		const rng = createRng(9);
		expect(["a", "b"]).toContain(rng.pick(["a", "b"]));
		expect(rng.string("xy", 40)).toMatch(/^[xy]{40}$/);
		expect(rng.bytes(16)).toHaveLength(16);
		expect(() => rng.pick([])).toThrow("empty list");
		expect(rng.chance(1)).toBe(true);
		expect(rng.chance(0)).toBe(false);
	});

	it("covers the whole byte range", () => {
		const bytes = createRng(3).bytes(8192);
		expect(new Set(bytes).size).toBeGreaterThan(250);
	});
});

describe("runCases", () => {
	it("hands every case its own reproducible stream", async () => {
		const first: number[] = [];
		const second: number[] = [];
		await runCases("a", 5, (rng) => void first.push(rng.next()), 11);
		await runCases("a", 5, (rng) => void second.push(rng.next()), 11);
		expect(first).toEqual(second);
		expect(new Set(first).size).toBe(5);
	});

	it("names the label, seed and case of a failure and keeps the cause", async () => {
		const boom = new Error("boom");
		const failure = await runCases(
			"label-x",
			10,
			(_rng, index) => {
				if (index === 4) {
					throw boom;
				}
			},
			99,
		).catch((error: Error) => error);
		expect(failure).toBeInstanceOf(Error);
		const error = failure as Error;
		expect(error.message).toContain("label-x: seed=99 case=4");
		expect(error.message).toContain("boom");
		expect(error.cause).toBe(boom);
	});

	it("replays one case with the stream it had in the run", async () => {
		const all: number[] = [];
		await runCases("r", 6, (rng) => void all.push(rng.next()), 5);
		let replayed = -1;
		await replayCase("r", 5, 3, (rng) => {
			replayed = rng.next();
		});
		expect(replayed).toBe(all[3] as number);
	});

	it("reports a thrown non-error value", async () => {
		const failure = await runCases("s", 1, () => {
			throw "plain";
		}).catch((error: Error) => error);
		expect((failure as Error).message).toContain("plain");
	});
});

describe("activeSeed", () => {
	it("uses the fixed default when GENERATED_SEED is unset or blank, and the integer when it is set", () => {
		const saved = process.env["GENERATED_SEED"];
		try {
			delete process.env["GENERATED_SEED"];
			expect(activeSeed()).toBe(DEFAULT_SEED);
			process.env["GENERATED_SEED"] = "42";
			expect(activeSeed()).toBe(42);
			process.env["GENERATED_SEED"] = " 7 ";
			expect(activeSeed()).toBe(7);
			process.env["GENERATED_SEED"] = "";
			expect(activeSeed()).toBe(DEFAULT_SEED);
		} finally {
			if (saved === undefined) {
				delete process.env["GENERATED_SEED"];
			} else {
				process.env["GENERATED_SEED"] = saved;
			}
		}
	});
});

describe("a seed from the environment", () => {
	const withSeed = (value: string, body: () => void) => {
		const saved = process.env["GENERATED_SEED"];
		process.env["GENERATED_SEED"] = value;
		try {
			body();
		} finally {
			if (saved === undefined) {
				delete process.env["GENERATED_SEED"];
			} else {
				process.env["GENERATED_SEED"] = saved;
			}
		}
	};

	it("is refused when it is not a non-negative integer", () => {
		for (const bad of ["not-a-number", "-5", "1.5", "1e3", "0x10"]) {
			withSeed(bad, () => {
				expect(() => activeSeed()).toThrow("GENERATED_SEED must be");
			});
		}
	});

	it("drives runCases and is printed by the failure", async () => {
		const seen: number[] = [];
		const run = (): Promise<unknown> =>
			runCases("env", 3, (rng, index) => {
				seen.push(rng.int(0, 1_000_000));
				if (index === 1) {
					throw new Error("nope");
				}
			}).catch((error: Error) => error as Error);
		const saved = process.env["GENERATED_SEED"];
		process.env["GENERATED_SEED"] = "123";
		let failure: unknown;
		try {
			failure = await run();
		} finally {
			if (saved === undefined) {
				delete process.env["GENERATED_SEED"];
			} else {
				process.env["GENERATED_SEED"] = saved;
			}
		}

		const message = (failure as Error).message;
		expect(message).toContain("env: seed=123 case=1");
		expect(message).toContain("GENERATED_SEED=123");
		const replay: number[] = [];
		await runCases(
			"env",
			2,
			(rng) => void replay.push(rng.int(0, 1_000_000)),
			123,
		);
		expect(seen).toEqual(replay);
	});
});
