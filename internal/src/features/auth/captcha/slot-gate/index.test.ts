import { describe, expect, it } from "bun:test";

import { createSlotGate } from ".";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("createSlotGate", () => {
	it("hands out slots up to the maximum at once", async () => {
		const gate = createSlotGate({ max: 2, queueMax: 4, waitMs: 50 });

		expect(await gate.acquire()).toBe(true);
		expect(await gate.acquire()).toBe(true);
	});

	it("serves a burst above the maximum in arrival order as slots free up", async () => {
		const gate = createSlotGate({ max: 1, queueMax: 8, waitMs: 1_000 });
		const order: number[] = [];
		await gate.acquire();
		const waiting = [1, 2, 3].map((n) =>
			gate.acquire().then((ok) => {
				if (ok) {
					order.push(n);
				}
				return ok;
			}),
		);
		await sleep(5);
		expect(order).toEqual([]);

		for (let i = 0; i < 3; i += 1) {
			gate.release();
			await sleep(5);
		}

		expect(await Promise.all(waiting)).toEqual([true, true, true]);
		expect(order).toEqual([1, 2, 3]);
	});

	it("refuses a waiter once its time is up and leaves the line for the others", async () => {
		const gate = createSlotGate({ max: 1, queueMax: 8, waitMs: 30 });
		await gate.acquire();

		const started = performance.now();
		const refused = await gate.acquire();

		expect(refused).toBe(false);
		expect(performance.now() - started).toBeLessThan(500);
		// The timed-out waiter is gone: a freed slot is free, not lost to it.
		gate.release();
		expect(await gate.acquire()).toBe(true);
	});

	it("refuses at once when the line is full", async () => {
		const gate = createSlotGate({ max: 1, queueMax: 2, waitMs: 1_000 });
		await gate.acquire();
		const inLine = [gate.acquire(), gate.acquire()];

		const started = performance.now();
		expect(await gate.acquire()).toBe(false);
		expect(performance.now() - started).toBeLessThan(100);

		gate.release();
		gate.release();
		gate.release();
		expect(await Promise.all(inLine)).toEqual([true, true]);
	});

	it("does not leak a slot when the holder releases with nobody waiting", async () => {
		const gate = createSlotGate({ max: 1, queueMax: 0, waitMs: 10 });
		for (let i = 0; i < 3; i += 1) {
			expect(await gate.acquire()).toBe(true);
			gate.release();
		}
	});
});
