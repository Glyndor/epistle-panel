import { expect, it } from "bun:test";
import { formatRowDate } from ".";

const format = {
	dateTime: (date: Date, options: Intl.DateTimeFormatOptions) =>
		new Intl.DateTimeFormat("en-GB", options).format(date),
};
it("prints both row date parts in the supplied clock with unchanged UTC output", () => {
	const at = "2026-03-08T12:15:00Z";
	expect(formatRowDate(format, at, "time", "Asia/Kolkata")).toBe("17:45");
	expect(formatRowDate(format, at, "day", "Pacific/Kiritimati")).toBe(
		"9 Mar",
	);
	expect(formatRowDate(format, at, "time", "UTC")).toBe("12:15");
	expect(
		formatRowDate(
			format,
			"2026-03-08T07:00:00Z",
			"time",
			"America/New_York",
		),
	).toBe("3:00");
});
