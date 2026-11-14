import { describe, expect, it } from "bun:test";

import { dateGroup, dateGroupKey, groupByDate, utcDay } from ".";

const TODAY = "2026-11-13";

describe("utcDay", () => {
	it("is the day in UTC, whatever the hour", () => {
		expect(utcDay(new Date("2026-11-13T00:00:00Z"))).toBe("2026-11-13");
		expect(utcDay(new Date("2026-11-13T23:59:59.999Z"))).toBe("2026-11-13");
		// 20:30 on the 12th in Bogotá is already the 13th in UTC.
		expect(utcDay(new Date("2026-11-12T20:30:00-05:00"))).toBe(
			"2026-11-13",
		);
	});
});

describe("dateGroup", () => {
	it("puts a message under today, yesterday, the week or its month", () => {
		const cases = [
			["2026-11-13T00:00:00Z", "today"],
			["2026-11-13T23:59:59Z", "today"],
			["2026-11-12T23:59:59Z", "yesterday"],
			["2026-11-12T00:00:00Z", "yesterday"],
			["2026-11-11T23:59:59Z", "week"],
			["2026-11-07T00:00:00Z", "week"],
			["2026-11-06T23:59:59Z", "month-2026-11"],
			["2026-11-01T00:00:00Z", "month-2026-11"],
			["2026-10-31T23:59:59Z", "month-2026-10"],
			["2025-11-13T12:00:00Z", "month-2025-11"],
			["1999-01-01T00:00:00Z", "month-1999-01"],
		] as const;
		for (const [receivedAt, key] of cases) {
			expect(dateGroupKey(dateGroup(receivedAt, TODAY))).toBe(key);
		}
	});

	it("counts days in UTC whatever offset the date is written with", () => {
		// 22:00 on the 12th at -05:00 is 03:00 on the 13th in UTC.
		expect(dateGroup("2026-11-12T22:00:00-05:00", TODAY)).toEqual({
			kind: "today",
		});
		// 01:00 on the 13th at +05:00 is 20:00 on the 12th in UTC.
		expect(dateGroup("2026-11-13T01:00:00+05:00", TODAY)).toEqual({
			kind: "yesterday",
		});
	});

	it("crosses a month and a year by days, not by calendar fields", () => {
		expect(dateGroup("2026-10-31T10:00:00Z", "2026-11-01")).toEqual({
			kind: "yesterday",
		});
		expect(dateGroup("2025-12-31T10:00:00Z", "2026-01-01")).toEqual({
			kind: "yesterday",
		});
		expect(dateGroup("2025-12-28T10:00:00Z", "2026-01-02")).toEqual({
			kind: "week",
		});
		expect(dateGroup("2024-02-29T10:00:00Z", "2024-03-01")).toEqual({
			kind: "yesterday",
		});
	});

	it("holds a message dated in the future as today's", () => {
		expect(dateGroup("2026-11-14T00:00:00Z", TODAY)).toEqual({
			kind: "today",
		});
		expect(dateGroup("2099-01-01T00:00:00Z", TODAY)).toEqual({
			kind: "today",
		});
	});

	it("says it does not know for a date or a day that is not one", () => {
		for (const receivedAt of ["", "x", "2026-13-45T00:00:00Z"]) {
			expect(dateGroup(receivedAt, TODAY)).toEqual({ kind: "unknown" });
		}
		for (const today of [
			"",
			"today",
			"2026-02-31",
			"2026-11-13T00:00:00Z",
		]) {
			expect(dateGroup("2026-11-13T00:00:00Z", today)).toEqual({
				kind: "unknown",
			});
		}
	});

	it("names the month from 1 to 12", () => {
		expect(dateGroup("2026-01-15T00:00:00Z", TODAY)).toEqual({
			kind: "month",
			year: 2026,
			month: 1,
		});
		expect(dateGroup("2025-12-15T00:00:00Z", TODAY)).toEqual({
			kind: "month",
			year: 2025,
			month: 12,
		});
	});
});

describe("groupByDate", () => {
	const row = (id: string, receivedAt: string) => ({ id, receivedAt });

	it("splits the rows into runs and keeps their order", () => {
		const runs = groupByDate(
			[
				row("a", "2026-11-13T10:00:00Z"),
				row("b", "2026-11-13T09:00:00Z"),
				row("c", "2026-11-12T09:00:00Z"),
				row("d", "2026-11-09T09:00:00Z"),
				row("e", "2026-11-08T09:00:00Z"),
				row("f", "2026-10-20T09:00:00Z"),
				row("g", "2026-10-02T09:00:00Z"),
				row("h", "2026-09-30T09:00:00Z"),
			],
			TODAY,
		);
		expect(
			runs.map((run) => [
				dateGroupKey(run.group),
				run.rows.map((r) => r.id).join(""),
			]),
		).toEqual([
			["today", "ab"],
			["yesterday", "c"],
			["week", "de"],
			["month-2026-10", "fg"],
			["month-2026-09", "h"],
		]);
	});

	it("never moves a row that is out of order: it starts a run of its own", () => {
		const runs = groupByDate(
			[
				row("a", "2026-11-13T10:00:00Z"),
				row("b", "2026-10-01T10:00:00Z"),
				row("c", "2026-11-13T08:00:00Z"),
				row("d", "not a date"),
			],
			TODAY,
		);
		expect(runs.map((run) => dateGroupKey(run.group))).toEqual([
			"today",
			"month-2026-10",
			"today",
			"unknown",
		]);
		expect(runs.flatMap((run) => run.rows.map((r) => r.id))).toEqual([
			"a",
			"b",
			"c",
			"d",
		]);
	});

	it("gives no run for no row", () => {
		expect(groupByDate([], TODAY)).toEqual([]);
	});
});
