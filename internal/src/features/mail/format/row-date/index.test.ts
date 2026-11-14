import { describe, expect, it } from "bun:test";

import { formatRowDate, rowDatePart } from ".";

/** Answers as `Intl` would in English, and records what it was asked. */
function recorder() {
	const asked: Intl.DateTimeFormatOptions[] = [];
	return {
		asked,
		dateTime(value: Date, options: Intl.DateTimeFormatOptions): string {
			asked.push(options);
			return new Intl.DateTimeFormat("en", options).format(value);
		},
	};
}

describe("rowDatePart", () => {
	it("is the time under today and yesterday, whose heading already says the day", () => {
		expect(rowDatePart("today")).toBe("time");
		expect(rowDatePart("yesterday")).toBe("time");
	});

	it("is the day under every other heading", () => {
		expect(rowDatePart("week")).toBe("day");
		expect(rowDatePart("month")).toBe("day");
		expect(rowDatePart("unknown")).toBe("day");
	});
});

describe("formatRowDate", () => {
	it("prints the hour and the minute in UTC", () => {
		const format = recorder();

		expect(formatRowDate(format, "2026-11-12T23:05:00Z", "time")).toBe(
			"11:05 PM",
		);
		expect(format.asked).toEqual([
			{ hour: "numeric", minute: "2-digit", timeZone: "UTC" },
		]);
	});

	it("prints the day and a short month in UTC, with no year", () => {
		const format = recorder();

		// One minute into the 1st in UTC is still the 31st west of Greenwich.
		expect(formatRowDate(format, "2026-11-01T00:01:00Z", "day")).toBe(
			"Nov 1",
		);
		expect(format.asked).toEqual([
			{ month: "short", day: "numeric", timeZone: "UTC" },
		]);
	});

	it("is empty for a value that is not a date, and asks the formatter nothing", () => {
		const format = recorder();

		expect(formatRowDate(format, "not a date", "time")).toBe("");
		expect(formatRowDate(format, "", "day")).toBe("");
		expect(format.asked).toHaveLength(0);
	});
});
