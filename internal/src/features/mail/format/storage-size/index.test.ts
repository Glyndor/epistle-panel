import { describe, expect, it } from "bun:test";

import { type StorageSize, storageSize } from ".";

describe("storageSize", () => {
	it("writes a size in the unit that keeps it under a thousand", () => {
		const cases: ReadonlyArray<
			readonly [number, number, StorageSize["unit"]]
		> = [
			[1_000, 1, "KB"],
			[12_345, 12, "KB"],
			[999_499, 999, "KB"],
			[1_000_000, 1, "MB"],
			[1_250_000, 1.3, "MB"],
			[25_000_000, 25, "MB"],
			[1_000_000_000, 1, "GB"],
			[5_368_709_120, 5.4, "GB"],
			[1_000_000_000_000, 1, "TB"],
			[2_500_000_000_000, 2.5, "TB"],
		];
		for (const [bytes, value, unit] of cases) {
			expect([bytes, storageSize(bytes)]).toEqual([
				bytes,
				{ value, unit },
			]);
		}
	});

	it("never writes a thousand of a unit: a size that rounds up to one reads as the next unit", () => {
		expect(storageSize(999_999)).toEqual({ value: 1, unit: "MB" });
		expect(storageSize(999_500)).toEqual({ value: 1, unit: "MB" });
		expect(storageSize(999_950_000)).toEqual({ value: 1, unit: "GB" });
		expect(storageSize(999_949_999)).toEqual({ value: 999.9, unit: "MB" });
		expect(storageSize(999_950_000_000)).toEqual({ value: 1, unit: "TB" });
	});

	it("reads nothing as zero and a few bytes as one kilobyte", () => {
		expect(storageSize(0)).toEqual({ value: 0, unit: "KB" });
		expect(storageSize(1)).toEqual({ value: 1, unit: "KB" });
		expect(storageSize(499)).toEqual({ value: 1, unit: "KB" });
		expect(storageSize(1_499)).toEqual({ value: 1, unit: "KB" });
		expect(storageSize(1_500)).toEqual({ value: 2, unit: "KB" });
	});

	it("reads what is no size as zero", () => {
		for (const bytes of [
			-1,
			-5_000_000,
			Number.NaN,
			Number.POSITIVE_INFINITY,
			Number.NEGATIVE_INFINITY,
		]) {
			expect([bytes, storageSize(bytes)]).toEqual([
				bytes,
				{ value: 0, unit: "KB" },
			]);
		}
	});

	it("lets the number grow past the largest unit", () => {
		expect(storageSize(5_000_000_000_000_000)).toEqual({
			value: 5000,
			unit: "TB",
		});
	});
});
