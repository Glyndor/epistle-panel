import { expect, it } from "bun:test";
import { formatTime } from ".";

it("prints fixed instants in half-hour and date-line clocks and keeps UTC bytes", () => {
	const at = Date.parse("2026-03-08T12:15:30Z") / 1000;
	expect(formatTime(at, "Asia/Kolkata")).toBe("2026-03-08 17:45:30");
	expect(formatTime(at, "Pacific/Kiritimati")).toBe("2026-03-09 02:15:30");
	expect(formatTime(at, "UTC")).toBe(
		new Date(at * 1000).toISOString().slice(0, 19).replace("T", " "),
	);
	expect(formatTime(at, "Asia/Kolkata")).toBe("2026-03-08 17:45:30");
});
it("skips the missing spring hour and repeats the fall hour with real DST rules", () => {
	for (const [at, expected] of [
		["2026-03-08T06:59:59Z", "2026-03-08 01:59:59"],
		["2026-03-08T07:00:00Z", "2026-03-08 03:00:00"],
		["2026-11-01T05:30:00Z", "2026-11-01 01:30:00"],
		["2026-11-01T06:30:00Z", "2026-11-01 01:30:00"],
	])
		expect(
			formatTime(Date.parse(at ?? "") / 1000, "America/New_York"),
		).toBe(expected ?? "");
});
