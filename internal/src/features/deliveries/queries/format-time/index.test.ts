import { describe, expect, it } from "bun:test";

import { formatTime } from ".";

describe("formatTime", () => {
	it("prints an epoch second as UTC, whatever the process time zone", () => {
		expect(formatTime(0, "UTC")).toBe("1970-01-01 00:00:00");
		expect(formatTime(1_700_000_000, "UTC")).toBe("2023-11-14 22:13:20");
		expect(formatTime(253_402_300_799, "UTC")).toBe("9999-12-31 23:59:59");
	});

	it("prints a dash for a value that is not a date instead of throwing", () => {
		for (const value of [Number.NaN, Number.POSITIVE_INFINITY, 1e300]) {
			expect(formatTime(value, "UTC")).toBe("-");
		}
	});
});
