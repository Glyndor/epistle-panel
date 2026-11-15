import { expect, it } from "bun:test";
import { dateGroupLabel } from ".";

it("keeps the named month in extreme zones and passes the requested zone", () => {
	for (const zone of [
		"UTC",
		"America/New_York",
		"Asia/Kolkata",
		"Pacific/Kiritimati",
	]) {
		const calls: string[] = [];
		const label = dateGroupLabel(
			{ kind: "month", year: 2026, month: 3 },
			(key) => key,
			{
				dateTime: (date, options) => {
					calls.push(options.timeZone);
					return new Intl.DateTimeFormat("en-GB", options).format(
						date,
					);
				},
			},
			zone,
		);
		expect(label).toBe("March 2026");
		expect(calls).toEqual([zone]);
	}
});
