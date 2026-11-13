import { describe, expect, it } from "bun:test";

import type { DeliveryOutcome } from "@/lib/api/schemas";

import { bucketDeliveries } from ".";

/** 2027-01-15 08:30:00 UTC, the moment every case here is read at. */
const NOW = 1_800_001_800;
/** 2027-01-15 00:00:00 UTC. */
const TODAY = 1_799_971_200;
const HOUR = 3600;
const DAY = 86_400;

const record = (time: number, outcome: DeliveryOutcome = "delivered") => ({
	time,
	outcome,
});
const totals = (timeline: ReturnType<typeof bucketDeliveries>) =>
	timeline.buckets.map((bucket) => bucket.total);

describe("bucketDeliveries, 24 hours", () => {
	it("has a column per clock hour, from the hour 24 hours ago to this one", () => {
		const timeline = bucketDeliveries([], "24h", NOW, false);

		expect(timeline.unit).toBe("hour");
		expect(timeline.buckets).toHaveLength(25);
		// 2027-01-14 08:00 and 2027-01-15 08:00, both UTC.
		expect(timeline.buckets[0]?.start).toBe(1_799_913_600);
		expect(timeline.buckets[24]?.start).toBe(1_800_000_000);
	});

	it("puts a record in the hour of the UTC clock it happened in", () => {
		const timeline = bucketDeliveries(
			[
				record(TODAY + 7 * HOUR + 59 * 60 + 59),
				record(TODAY + 8 * HOUR),
				record(TODAY + 8 * HOUR + 29 * 60),
				record(TODAY - 1),
			],
			"24h",
			NOW,
			false,
		);

		// 07:59:59 is the 07:00 column, 08:00:00 opens the last one, and
		// 23:59:59 of the day before is the 23:00 column.
		expect(totals(timeline).slice(15)).toEqual([
			1, 0, 0, 0, 0, 0, 0, 0, 1, 2,
		]);
	});

	it("counts each outcome apart, in the API's order", () => {
		const hour = TODAY + 5 * HOUR;
		const timeline = bucketDeliveries(
			[
				record(hour, "failed"),
				record(hour + 60, "delivered"),
				record(hour + 120, "delivered"),
				record(hour + 180, "canceled"),
				record(hour + 240, "deferred"),
				record(hour + 300, "suppressed"),
				record(hour + 360, "failed"),
			],
			"24h",
			NOW,
			false,
		);

		expect(timeline.buckets[21]).toEqual({
			start: hour,
			counts: [2, 1, 2, 1, 1],
			total: 7,
			state: "complete",
		});
		expect(timeline.peak).toBe(7);
	});

	it("loses no record: the columns add up to the records", () => {
		const entries = Array.from({ length: 97 }, (_, index) =>
			record(NOW - DAY + index * 890),
		);
		const timeline = bucketDeliveries(entries, "24h", NOW, false);

		expect(totals(timeline).reduce((sum, value) => sum + value, 0)).toBe(
			97,
		);
		expect(timeline.total).toBe(97);
	});

	it("keeps a record from the first half hour of the period, before the first whole hour", () => {
		// 24 hours before 08:30 is 08:30 of the day before, inside the 08:00 column.
		const timeline = bucketDeliveries(
			[record(NOW - DAY)],
			"24h",
			NOW,
			false,
		);

		expect(totals(timeline)[0]).toBe(1);
	});

	it("counts a record a moment outside the period in the nearest column", () => {
		const timeline = bucketDeliveries(
			[record(NOW - DAY - 2 * HOUR), record(NOW + 3 * HOUR)],
			"24h",
			NOW,
			false,
		);

		expect(totals(timeline)[0]).toBe(1);
		expect(totals(timeline)[24]).toBe(1);
	});

	it("has every column whole when the answer was not cut", () => {
		const timeline = bucketDeliveries(
			[record(NOW - 60)],
			"24h",
			NOW,
			false,
		);

		expect(
			timeline.buckets.every((bucket) => bucket.state === "complete"),
		).toBe(true);
	});
});

describe("bucketDeliveries, a full answer", () => {
	it("marks the hours the answer did not reach, in the day it stopped in", () => {
		// The API read all of today, then yesterday from its first record, and
		// stopped at 12:20 with the limit reached.
		const timeline = bucketDeliveries(
			[
				record(TODAY + 10 * 60),
				record(TODAY + 3 * HOUR),
				record(TODAY - DAY + 9 * HOUR),
				record(TODAY - DAY + 12 * HOUR + 20 * 60),
			],
			"24h",
			NOW,
			true,
		);
		const states = timeline.buckets.map((bucket) => bucket.state);

		// Yesterday 08:00 to 11:00 were read whole, 12:00 in part, 13:00 to
		// 23:00 not at all; today's nine columns were read whole.
		expect(states.slice(0, 4)).toEqual([
			"complete",
			"complete",
			"complete",
			"complete",
		]);
		expect(states[4]).toBe("partial");
		expect(states.slice(5, 16)).toEqual(Array(11).fill("missing"));
		expect(states.slice(16)).toEqual(Array(9).fill("complete"));
	});

	it("marks the rest of today and all of yesterday when it stopped today", () => {
		const timeline = bucketDeliveries(
			[record(TODAY + 30 * 60), record(TODAY + 2 * HOUR + 5 * 60)],
			"24h",
			NOW,
			true,
		);
		const states = timeline.buckets.map((bucket) => bucket.state);

		expect(states.slice(0, 16)).toEqual(Array(16).fill("missing"));
		expect(states.slice(16, 18)).toEqual(["complete", "complete"]);
		expect(states[18]).toBe("partial");
		expect(states.slice(19)).toEqual(Array(6).fill("missing"));
	});

	it("marks whole days in a period of days", () => {
		const timeline = bucketDeliveries(
			[
				record(TODAY + HOUR),
				record(TODAY - DAY + 5 * HOUR),
				record(TODAY - 2 * DAY + 60),
			],
			"7d",
			NOW,
			true,
		);
		const states = timeline.buckets.map((bucket) => bucket.state);

		// Five days never reached, the day it stopped in, two read whole.
		expect(states).toEqual([
			"missing",
			"missing",
			"missing",
			"missing",
			"missing",
			"partial",
			"complete",
			"complete",
		]);
	});

	it("does not mark anything for a full answer with no record", () => {
		const timeline = bucketDeliveries([], "24h", NOW, true);

		expect(
			timeline.buckets.every((bucket) => bucket.state === "complete"),
		).toBe(true);
	});
});

describe("bucketDeliveries, days", () => {
	it("has a column per UTC day for 7 days, the first and the last in part", () => {
		const timeline = bucketDeliveries([], "7d", NOW, false);

		expect(timeline.unit).toBe("day");
		expect(timeline.buckets.map((bucket) => bucket.start)).toEqual([
			TODAY - 7 * DAY,
			TODAY - 6 * DAY,
			TODAY - 5 * DAY,
			TODAY - 4 * DAY,
			TODAY - 3 * DAY,
			TODAY - 2 * DAY,
			TODAY - DAY,
			TODAY,
		]);
	});

	it("has 31 columns for 30 days", () => {
		const timeline = bucketDeliveries([], "30d", NOW, false);

		expect(timeline.buckets).toHaveLength(31);
		expect(timeline.buckets[0]?.start).toBe(TODAY - 30 * DAY);
		expect(timeline.buckets[30]?.start).toBe(TODAY);
	});

	it("splits two records a second apart across midnight UTC", () => {
		const timeline = bucketDeliveries(
			[record(TODAY - 1), record(TODAY)],
			"7d",
			NOW,
			false,
		);

		expect(totals(timeline).slice(6)).toEqual([1, 1]);
	});

	it("has no peak with no record", () => {
		expect(bucketDeliveries([], "30d", NOW, false).peak).toBe(0);
	});
});
