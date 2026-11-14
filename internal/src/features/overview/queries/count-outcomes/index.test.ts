import { describe, expect, it } from "bun:test";

import type { DeliveryOutcome } from "@/lib/api/schemas";

import { countOutcomes } from ".";

const records = (...outcomes: DeliveryOutcome[]) =>
	outcomes.map((outcome) => ({ outcome }));

describe("countOutcomes", () => {
	it("counts each outcome and keeps the API's order", () => {
		const counted = countOutcomes(
			records(
				"failed",
				"delivered",
				"delivered",
				"canceled",
				"delivered",
				"deferred",
				"delivered",
				"suppressed",
			),
		);

		expect(counted.total).toBe(8);
		expect(counted.parts).toEqual([
			{ outcome: "delivered", count: 4, share: 500 },
			{ outcome: "deferred", count: 1, share: 125 },
			{ outcome: "failed", count: 1, share: 125 },
			{ outcome: "suppressed", count: 1, share: 125 },
			{ outcome: "canceled", count: 1, share: 125 },
		]);
	});

	it("lists an outcome nothing had, at zero", () => {
		const counted = countOutcomes(records("delivered", "delivered"));

		expect(counted.parts.map((part) => part.count)).toEqual([
			2, 0, 0, 0, 0,
		]);
		expect(counted.parts.map((part) => part.share)).toEqual([
			1000, 0, 0, 0, 0,
		]);
	});

	it("gives shares that add up to a whole when thirds do not", () => {
		const counted = countOutcomes(
			records("delivered", "deferred", "failed"),
		);
		const shares = counted.parts.map((part) => part.share);

		expect(shares).toEqual([334, 333, 333, 0, 0]);
		expect(shares.reduce((sum, share) => sum + share, 0)).toBe(1000);
	});

	it("has five parts at zero for no record", () => {
		const counted = countOutcomes([]);

		expect(counted.total).toBe(0);
		expect(counted.parts.map((part) => part.count)).toEqual([
			0, 0, 0, 0, 0,
		]);
		expect(counted.parts.map((part) => part.share)).toEqual([
			0, 0, 0, 0, 0,
		]);
	});
});
