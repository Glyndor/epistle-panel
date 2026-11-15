import { describe, expect, it } from "bun:test";

import { calendarFormatters, calendarText } from ".";

// Noon on the wall of the runtime, the way the calendar holds its dates.
const SUNDAY = new Date(2026, 10, 15, 12);

describe("calendarText", () => {
	it("writes the month, the weekdays and the day in the language asked for", () => {
		const en = calendarText("en");
		expect(en.caption(SUNDAY)).toBe("November 2026");
		expect(en.weekdayShort(SUNDAY)).toBe("S");
		expect(en.weekdayLong(SUNDAY)).toBe("Sunday");
		expect(en.dayLong(SUNDAY)).toBe("Sunday, November 15, 2026");

		const es = calendarText("es");
		expect(es.caption(SUNDAY)).toBe("noviembre de 2026");
		expect(es.weekdayLong(SUNDAY)).toBe("domingo");
		expect(es.dayLong(SUNDAY)).toContain("15 de noviembre de 2026");
	});

	it("keeps one set of writers per language", () => {
		expect(calendarText("de")).toBe(calendarText("de"));
		expect(calendarText("de")).not.toBe(calendarText("fr"));
	});

	it("gives the library the caption and the short weekday, and nothing else", () => {
		const formatters = calendarFormatters(calendarText("fr"));

		expect(Object.keys(formatters).sort()).toEqual([
			"formatCaption",
			"formatWeekdayName",
		]);
		expect(formatters.formatCaption?.(SUNDAY)).toBe("novembre 2026");
		expect(formatters.formatWeekdayName?.(SUNDAY)).toBe("D");
	});
});
