import { describe, expect, it } from "bun:test";

import { dateGroupLabel } from ".";

const t = (key: string) => key;
/** A formatter that records what it was asked, and answers as `Intl` would in English. */
function recorder() {
	const asked: Array<{ value: Date; options: Intl.DateTimeFormatOptions }> =
		[];
	return {
		asked,
		dateTime(value: Date, options: Intl.DateTimeFormatOptions): string {
			asked.push({ value, options });
			return new Intl.DateTimeFormat("en", options).format(value);
		},
	};
}

describe("dateGroupLabel", () => {
	it("names today, yesterday, the last few days and a message with no date by their message", () => {
		const format = recorder();

		expect(dateGroupLabel({ kind: "today" }, t, format)).toBe("groupToday");
		expect(dateGroupLabel({ kind: "yesterday" }, t, format)).toBe(
			"groupYesterday",
		);
		expect(dateGroupLabel({ kind: "week" }, t, format)).toBe("groupRecent");
		expect(dateGroupLabel({ kind: "unknown" }, t, format)).toBe(
			"groupUnknown",
		);
		expect(format.asked).toHaveLength(0);
	});

	it("names an older group by its month and year", () => {
		const format = recorder();

		expect(
			dateGroupLabel({ kind: "month", year: 2026, month: 10 }, t, format),
		).toBe("October 2026");
		expect(
			dateGroupLabel({ kind: "month", year: 2025, month: 1 }, t, format),
		).toBe("January 2025");
		expect(
			dateGroupLabel({ kind: "month", year: 2025, month: 12 }, t, format),
		).toBe("December 2025");
	});

	it("asks for the month in UTC, from the first instant of that month", () => {
		const format = recorder();

		dateGroupLabel({ kind: "month", year: 2026, month: 10 }, t, format);

		// In a zone west of Greenwich the first instant of October is still
		// September: without the zone the heading would name the wrong month.
		expect(format.asked).toEqual([
			{
				value: new Date("2026-10-01T00:00:00.000Z"),
				options: { month: "long", year: "numeric", timeZone: "UTC" },
			},
		]);
		expect(
			new Intl.DateTimeFormat("en", {
				month: "long",
				timeZone: "America/Bogota",
			}).format(new Date("2026-10-01T00:00:00.000Z")),
		).toBe("September");
	});
});
