import { expect, it } from "bun:test";
import { dayInZone, dayNumber } from ".";

it("finds local days across half-hour, date-line and DST midnights with isolated zone caches", () => {
	const at = new Date("2026-03-08T00:15:00Z");
	for (let i = 0; i < 2; i++) {
		expect(dayInZone(at, "UTC")).toBe("2026-03-08");
		expect(dayInZone(at, "America/New_York")).toBe("2026-03-07");
		expect(dayInZone(at, "Asia/Kolkata")).toBe("2026-03-08");
		expect(
			dayInZone(new Date("2026-03-08T12:00:00Z"), "Pacific/Kiritimati"),
		).toBe("2026-03-09");
	}
	expect(
		dayInZone(new Date("2026-03-09T03:59:59Z"), "America/New_York"),
	).toBe("2026-03-08");
	expect(
		dayInZone(new Date("2026-03-09T04:00:00Z"), "America/New_York"),
	).toBe("2026-03-09");
});
it("counts actual calendar days and rejects rolling and malformed dates", () => {
	expect(dayNumber("1970-01-01")).toBe(0);
	expect(dayNumber("1969-12-31")).toBe(-1);
	expect(dayNumber("2024-02-29")).toBe(19782);
	expect(
		(dayNumber("2026-03-09") ?? 0) - (dayNumber("2026-03-08") ?? 0),
	).toBe(1);
	for (const bad of [
		"2026-02-29",
		"2026-02-31",
		"2026-13-01",
		"2026-00-01",
		"2026-01-00",
		"2026-01-32",
		"2026-1-01",
		"2026-01-01T00:00Z",
		"x",
		"0099-01-01",
	])
		expect(dayNumber(bad)).toBeNull();
});
