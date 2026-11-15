import { expect, it } from "bun:test";
import { fromEpochSeconds, momentFormat } from ".";

it("formats account moments in their named clock, preserving UTC bytes and DST", () => {
	const date = fromEpochSeconds(Date.parse("2026-03-08T07:00:00Z") / 1000);
	for (const [zone, expected] of [
		["UTC", "8 Mar 2026, 07:00 UTC"],
		["Asia/Kolkata", "8 Mar 2026, 12:30 GMT+5:30"],
		["Pacific/Kiritimati", "8 Mar 2026, 21:00 GMT+14"],
		["America/New_York", "8 Mar 2026, 03:00 GMT-4"],
	] as const)
		expect(
			new Intl.DateTimeFormat("en-GB", momentFormat(zone)).format(date),
		).toBe(expected);
});
