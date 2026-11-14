import { describe, expect, it } from "bun:test";

import { EMPTY_CONDITIONS, listConditionsSchema, parseListConditions } from ".";

describe("parseListConditions: one day", () => {
	for (const name of ["after", "before"] as const) {
		it(`keeps ${name} as written when it is a day of the calendar`, () => {
			for (const day of [
				"2026-11-10",
				"2024-02-29",
				"2000-02-29",
				"1970-01-01",
				"9999-12-31",
			]) {
				const parsed = parseListConditions({ [name]: day });
				expect([day, parsed.conditions[name], parsed.rejected]).toEqual(
					[day, day, []],
				);
			}
		});

		it(`rejects ${name} that is not a day of the calendar`, () => {
			for (const day of [
				"2026-02-30",
				"2026-02-29",
				"1900-02-29",
				"2026-04-31",
				"2026-13-01",
				"2026-00-10",
				"2026-11-00",
				"2026-11-32",
			]) {
				const parsed = parseListConditions({ [name]: day });
				expect([day, parsed.conditions[name], parsed.rejected]).toEqual(
					[day, null, [name]],
				);
			}
		});

		it(`rejects ${name} outside the years 1970 to 9999`, () => {
			for (const day of ["1969-12-31", "0000-01-01", "10000-01-01"]) {
				const parsed = parseListConditions({ [name]: day });
				expect([day, parsed.rejected]).toEqual([day, [name]]);
			}
		});

		it(`rejects ${name} written any other way than YYYY-MM-DD`, () => {
			for (const day of [
				"2026-11-10T00:00:00Z",
				"2026-11-10 ",
				" 2026-11-10",
				"2026-1-10",
				"2026/11/10",
				"20261110",
				"10-11-2026",
				"+2026-11-10",
				"２０２６-11-10",
				"today",
			]) {
				const parsed = parseListConditions({ [name]: day });
				expect([day, parsed.conditions[name], parsed.rejected]).toEqual(
					[day, null, [name]],
				);
			}
		});
	}
});

describe("parseListConditions: a range of days", () => {
	it("keeps a range, and a range of one day", () => {
		const range = parseListConditions({
			after: "2026-11-01",
			before: "2026-11-10",
		});
		expect(range.conditions).toEqual({
			...EMPTY_CONDITIONS,
			after: "2026-11-01",
			before: "2026-11-10",
		});
		expect(range.rejected).toEqual([]);

		const oneDay = parseListConditions({
			after: "2026-11-10",
			before: "2026-11-10",
		});
		expect(oneDay.conditions.after).toBe("2026-11-10");
		expect(oneDay.conditions.before).toBe("2026-11-10");
		expect(oneDay.rejected).toEqual([]);
	});

	it("rejects both days when after is later than before", () => {
		const parsed = parseListConditions({
			after: "2026-11-11",
			before: "2026-11-10",
			q: "kept",
		});
		expect(parsed.conditions).toEqual({ ...EMPTY_CONDITIONS, q: "kept" });
		expect(parsed.rejected).toEqual(["after", "before"]);
	});

	it("compares the days across a year, not only within a month", () => {
		const parsed = parseListConditions({
			after: "2026-01-01",
			before: "2025-12-31",
		});
		expect(parsed.rejected).toEqual(["after", "before"]);
	});

	it("names only the bad day when the other one is fine", () => {
		const badAfter = parseListConditions({
			after: "2026-02-30",
			before: "2026-01-01",
		});
		expect(badAfter.conditions.before).toBe("2026-01-01");
		expect(badAfter.rejected).toEqual(["after"]);

		const badBefore = parseListConditions({
			after: "2026-03-01",
			before: "2026-02-30",
		});
		expect(badBefore.conditions.after).toBe("2026-03-01");
		expect(badBefore.rejected).toEqual(["before"]);
	});

	it("keeps one day alone, whatever it is", () => {
		expect(parseListConditions({ after: "9999-12-31" }).rejected).toEqual(
			[],
		);
		expect(parseListConditions({ before: "1970-01-01" }).rejected).toEqual(
			[],
		);
	});
});

describe("listConditionsSchema: a range of days", () => {
	it("accepts a range of one day", () => {
		const range = {
			...EMPTY_CONDITIONS,
			after: "2026-11-10",
			before: "2026-11-10",
		};
		expect(listConditionsSchema.parse(range)).toEqual(range);
	});

	it("refuses a range whose after is later than its before, on both fields", () => {
		const result = listConditionsSchema.safeParse({
			...EMPTY_CONDITIONS,
			after: "2026-11-11",
			before: "2026-11-10",
		});
		expect(
			result.error?.issues.map((issue) => issue.path.join(".")).sort(),
		).toEqual(["after", "before"]);
	});
});
