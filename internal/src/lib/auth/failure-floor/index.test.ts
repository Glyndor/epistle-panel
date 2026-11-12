import { describe, expect, it } from "bun:test";

import { holdUntilFloor, LOGIN_FAILURE_FLOOR_MS } from ".";

describe("holdUntilFloor", () => {
	it("waits until the floor has passed since the start", async () => {
		const startedAt = Date.now();

		await holdUntilFloor(startedAt, 120);

		expect(Date.now() - startedAt).toBeGreaterThanOrEqual(115);
	});

	it("returns at once when the floor is already gone", async () => {
		const before = performance.now();

		await holdUntilFloor(Date.now() - 500, 100);

		expect(performance.now() - before).toBeLessThan(50);
	});

	it("keeps a floor above typical password hashing time", () => {
		expect(LOGIN_FAILURE_FLOOR_MS).toBeGreaterThanOrEqual(1000);
	});
});
