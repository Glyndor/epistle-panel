import { expect, it } from "bun:test";
import { formatReceivedAt } from ".";

const format = {
	dateTime: (date: Date, options: Intl.DateTimeFormatOptions) =>
		new Intl.DateTimeFormat("en-GB", options).format(date),
};
it("prints reader dates in the supplied zone with and without time and preserves UTC", () => {
	const at = "2026-03-08T12:15:00Z";
	expect(formatReceivedAt(format, at, "Asia/Kolkata")).toBe(
		"8 Mar 2026, 17:45",
	);
	expect(formatReceivedAt(format, at, "Pacific/Kiritimati", false)).toBe(
		"9 Mar 2026",
	);
	expect(formatReceivedAt(format, at, "UTC")).toBe("8 Mar 2026, 12:15");
	expect(
		formatReceivedAt(format, "2026-03-08T07:00:00Z", "America/New_York"),
	).toBe("8 Mar 2026, 03:00");
});
