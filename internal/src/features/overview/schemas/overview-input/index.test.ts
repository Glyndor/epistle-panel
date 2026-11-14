import { describe, expect, it } from "bun:test";

import type { Route } from "next";

import { OVERVIEW_PERIODS, overviewHref, parsePeriodParam } from ".";

describe("parsePeriodParam", () => {
	it("takes each period on offer", () => {
		expect(parsePeriodParam("24h")).toBe("24h");
		expect(parsePeriodParam("7d")).toBe("7d");
		expect(parsePeriodParam("30d")).toBe("30d");
	});

	it("offers exactly the three periods a chart can draw", () => {
		expect([...OVERVIEW_PERIODS]).toEqual(["24h", "7d", "30d"]);
	});

	it("is 24 hours when the address names no period", () => {
		expect(parsePeriodParam(undefined)).toBe("24h");
		expect(parsePeriodParam("")).toBe("24h");
	});

	it("drops a period the delivery log takes but no chart draws", () => {
		expect(parsePeriodParam("15m")).toBe("24h");
		expect(parsePeriodParam("1h")).toBe("24h");
	});

	it("drops anything else, whatever it looks like", () => {
		for (const hostile of [
			"7D",
			" 7d",
			"7d\n",
			"../7d",
			"1e9d",
			"7d&outcome=failed",
			"<script>",
			"9999d",
		]) {
			expect(parsePeriodParam(hostile)).toBe("24h");
		}
	});

	it("reads the first value of a repeated parameter", () => {
		expect(parsePeriodParam(["30d", "7d"])).toBe("30d");
		expect(parsePeriodParam(["nope", "7d"])).toBe("24h");
		expect(parsePeriodParam([])).toBe("24h");
	});
});

describe("overviewHref", () => {
	const home = "/app/admin-1" as Route;

	it("is the bare path for the default period, so it has one address", () => {
		expect(String(overviewHref(home, "24h"))).toBe("/app/admin-1");
	});

	it("names any other period in the query", () => {
		expect(String(overviewHref(home, "7d"))).toBe("/app/admin-1?since=7d");
		expect(String(overviewHref(home, "30d"))).toBe(
			"/app/admin-1?since=30d",
		);
	});

	it("gives an address that reads back as the same period", () => {
		for (const period of OVERVIEW_PERIODS) {
			const query = new URL(overviewHref(home, period), "http://x.test")
				.searchParams;

			expect(parsePeriodParam(query.get("since") ?? undefined)).toBe(
				period,
			);
		}
	});
});
