import { describe, expect, it } from "bun:test";

import { dateToDay, dayToDate, selectedDay } from ".";

describe("dayToDate", () => {
	it("builds the date from the numbers of the day, held at noon", () => {
		const date = dayToDate("2026-11-15");

		expect(date?.getFullYear()).toBe(2026);
		expect(date?.getMonth()).toBe(10);
		expect(date?.getDate()).toBe(15);
		expect(date?.getHours()).toBe(12);
	});

	it("reads the day the same in the days a clock change touches", () => {
		for (const day of [
			"2026-03-08",
			"2026-03-29",
			"2026-10-25",
			"2026-11-01",
		]) {
			expect(dateToDay(dayToDate(day) ?? new Date(NaN))).toBe(day);
		}
	});

	it("takes the first and the last day a condition names, and nothing outside them", () => {
		expect(dayToDate("1970-01-01")).toBeDefined();
		expect(dayToDate("9999-12-31")).toBeDefined();
		expect(dayToDate("1969-12-31")).toBeUndefined();
	});

	it("refuses text that is not a day of the calendar", () => {
		for (const bad of [
			"",
			"2026-02-30",
			"2026-13-01",
			"2026-1-1",
			"x",
			"2026-11-15T00:00",
		]) {
			expect(dayToDate(bad)).toBeUndefined();
		}
	});
});

describe("dateToDay", () => {
	it("writes the numbers on the date's own wall, padded", () => {
		expect(dateToDay(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
		expect(dateToDay(new Date(2026, 11, 31, 0, 0))).toBe("2026-12-31");
		expect(dateToDay(new Date(1999, 8, 9, 12))).toBe("1999-09-09");
	});
});

describe("selectedDay", () => {
	it("is the day both ends name", () => {
		expect(selectedDay({ after: "2026-11-10", before: "2026-11-10" })).toBe(
			"2026-11-10",
		);
	});

	it("is none for a range, for one end alone and for no condition", () => {
		expect(
			selectedDay({ after: "2026-11-10", before: "2026-11-12" }),
		).toBeNull();
		expect(selectedDay({ after: "2026-11-10", before: null })).toBeNull();
		expect(selectedDay({ after: null, before: "2026-11-10" })).toBeNull();
		expect(selectedDay({ after: null, before: null })).toBeNull();
	});

	it("is none for a text that is not a day, even when both ends say the same", () => {
		expect(selectedDay({ after: "soon", before: "soon" })).toBeNull();
		expect(
			selectedDay({ after: "2026-02-30", before: "2026-02-30" }),
		).toBeNull();
	});
});
