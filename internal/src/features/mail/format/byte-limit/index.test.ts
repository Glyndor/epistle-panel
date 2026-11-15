import { describe, expect, it } from "bun:test";

import { type ByteLimit, byteLimit } from ".";

describe("byteLimit", () => {
	it("writes a size in the binary unit that keeps it under a thousand", () => {
		const cases: ReadonlyArray<
			readonly [number, number, ByteLimit["unit"]]
		> = [
			[1_024, 1, "KiB"],
			[12_345, 12, "KiB"],
			[1_048_576, 1, "MiB"],
			[1_310_720, 1.2, "MiB"],
			[26_214_400, 25, "MiB"],
			[1_073_741_824, 1, "GiB"],
			[5_761_455_744, 5.3, "GiB"],
			[1_099_511_627_776, 1, "TiB"],
		];
		for (const [bytes, value, unit] of cases) {
			expect([bytes, byteLimit(bytes)]).toEqual([bytes, { value, unit }]);
		}
	});

	it("floors at unit boundaries and never promotes a size below the next unit", () => {
		expect(byteLimit(1_048_575)).toEqual({ value: 1023, unit: "KiB" });
		expect(byteLimit(1_052_672)).toEqual({ value: 1, unit: "MiB" });
		expect(byteLimit(1_073_741_823)).toEqual({
			value: 1023.9,
			unit: "MiB",
		});
		expect(byteLimit(1_073_741_824)).toEqual({ value: 1, unit: "GiB" });
	});

	it("floors even sizes below a kibibyte", () => {
		expect(byteLimit(0)).toEqual({ value: 0, unit: "KiB" });
		expect(byteLimit(1)).toEqual({ value: 0, unit: "KiB" });
		expect(byteLimit(1023)).toEqual({ value: 0, unit: "KiB" });
		expect(byteLimit(1024)).toEqual({ value: 1, unit: "KiB" });
	});

	it("reads what is no size as zero", () => {
		for (const bytes of [
			-1,
			-5_000_000,
			Number.NaN,
			Number.POSITIVE_INFINITY,
			Number.NEGATIVE_INFINITY,
		]) {
			expect([bytes, byteLimit(bytes)]).toEqual([
				bytes,
				{ value: 0, unit: "KiB" },
			]);
		}
	});

	it("lets the number grow past the largest unit", () => {
		expect(byteLimit(5_000_000_000_000_000)).toEqual({
			value: 4547.4,
			unit: "TiB",
		});
	});
});

it("never displays more bytes than the actual limit", () => {
	const factors = {
		KiB: 1024,
		MiB: 1024 ** 2,
		GiB: 1024 ** 3,
		TiB: 1024 ** 4,
	};
	for (const bytes of [
		1, 1023, 1024, 12345, 1_048_575, 1_048_576, 2_936_012, 2_936_013,
		3_000_000, 3_000_001, 1_073_741_823, 1_073_741_824,
	]) {
		const shown = byteLimit(bytes);
		expect(shown.value * factors[shown.unit]).toBeLessThanOrEqual(bytes);
	}
	expect(byteLimit(3_000_000)).toEqual({ value: 2.8, unit: "MiB" });
	expect(byteLimit(2_936_012)).toEqual({ value: 2.7, unit: "MiB" });
	expect(byteLimit(2_936_013)).toEqual({ value: 2.8, unit: "MiB" });
});
