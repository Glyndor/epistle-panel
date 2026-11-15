import { expect, it } from "bun:test";
import { dateGroup, groupByDate } from ".";

it("switches groups at local midnight including the 23-hour DST day", () => {
	expect(
		dateGroup("2026-03-09T03:59:59Z", "2026-03-09", "America/New_York"),
	).toEqual({ kind: "yesterday" });
	expect(
		dateGroup("2026-03-09T04:00:00Z", "2026-03-09", "America/New_York"),
	).toEqual({ kind: "today" });
	expect(
		dateGroup("2026-03-08T18:29:59Z", "2026-03-09", "Asia/Kolkata"),
	).toEqual({ kind: "yesterday" });
	expect(
		dateGroup("2026-03-08T18:30:00Z", "2026-03-09", "Asia/Kolkata"),
	).toEqual({ kind: "today" });
	expect(
		dateGroup("2026-03-08T10:00:00Z", "2026-03-09", "Pacific/Kiritimati"),
	).toEqual({ kind: "today" });
	expect(dateGroup("2026-03-08T10:00:00Z", "2026-03-09", "UTC")).toEqual({
		kind: "yesterday",
	});
});
it("uses the local month and forwards the clock when grouping ordered runs", () => {
	const rows = [
		{ receivedAt: "2026-03-01T04:59:59Z" },
		{ receivedAt: "2026-03-01T05:00:00Z" },
	] as const;
	expect(groupByDate(rows, "2026-03-15", "America/New_York")).toEqual([
		{ group: { kind: "month", year: 2026, month: 2 }, rows: [rows[0]] },
		{ group: { kind: "month", year: 2026, month: 3 }, rows: [rows[1]] },
	]);
});
