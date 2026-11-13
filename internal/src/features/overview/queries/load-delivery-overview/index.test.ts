import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";

import {
	deliveryEntries,
	deliveryEntry,
	stubOverviewApi,
} from "@/features/overview/test-support/api";
import { sentRequests, stubFetchReject } from "@/lib/api/test-support/fetch";
import {
	FAKE_CLOCK_START,
	useFakeClock,
	useRealClock,
} from "@/test/fake-clock";

import { loadDeliveryOverview } from ".";

const originalFetch = globalThis.fetch;
/** The fake clock's start in seconds: 2027-01-15 08:00:00 UTC. */
const NOW = 1_800_000_000;

beforeEach(() => {
	useFakeClock();
});
afterEach(() => {
	useRealClock();
	globalThis.fetch = originalFetch;
});

describe("loadDeliveryOverview", () => {
	it("starts the fake clock where the cases expect it", () => {
		expect(FAKE_CLOCK_START / 1000).toBe(NOW);
	});

	it("asks the API once, for the period and the 100 records it gives at most", async () => {
		stubOverviewApi();

		await loadDeliveryOverview("7d");

		expect(sentRequests().map((request) => request.url)).toEqual([
			"http://127.0.0.1:8025/api/v1/deliveries?since=7d&limit=100",
		]);
	});

	it("counts the records by outcome and over time, read at the clock's second", async () => {
		stubOverviewApi({
			deliveries: deliveryEntries(NOW - 60, { delivered: 3, failed: 1 }),
		});

		const overview = await loadDeliveryOverview("24h");

		if (overview.kind !== "data") {
			throw new Error(`expected data, got ${overview.kind}`);
		}
		expect(overview.period).toBe("24h");
		expect(overview.readAt).toBe(NOW);
		expect(overview.full).toBe(false);
		expect(overview.outcomes.total).toBe(4);
		expect(overview.outcomes.parts.map((part) => part.count)).toEqual([
			3, 0, 1, 0, 0,
		]);
		// All four fall in the hour before 08:00, the last but one column.
		expect(overview.timeline.buckets).toHaveLength(25);
		expect(overview.timeline.buckets[23]?.total).toBe(4);
		expect(overview.timeline.total).toBe(4);
	});

	it("draws both charts from the same records: the columns add up to the outcomes", async () => {
		stubOverviewApi({
			deliveries: deliveryEntries(NOW - 30, {
				delivered: 40,
				deferred: 7,
				failed: 5,
				suppressed: 2,
				canceled: 1,
			}),
		});

		const overview = await loadDeliveryOverview("24h");

		if (overview.kind !== "data") {
			throw new Error(`expected data, got ${overview.kind}`);
		}
		const columns = overview.timeline.buckets.reduce(
			(sum, bucket) => sum + bucket.total,
			0,
		);
		expect(columns).toBe(55);
		expect(overview.outcomes.total).toBe(55);
	});

	it("says the answer is full at 100 records and marks what it did not reach", async () => {
		const entries = Array.from({ length: 100 }, (_, index) =>
			deliveryEntry(NOW - 3600 - index, "delivered", index),
		);
		stubOverviewApi({ deliveries: entries });

		const overview = await loadDeliveryOverview("24h");

		if (overview.kind !== "data") {
			throw new Error(`expected data, got ${overview.kind}`);
		}
		expect(overview.full).toBe(true);
		expect(
			overview.timeline.buckets.some(
				(bucket) => bucket.state === "missing",
			),
		).toBe(true);
	});

	it("is not full one record short of 100, and every column is whole", async () => {
		const entries = Array.from({ length: 99 }, (_, index) =>
			deliveryEntry(NOW - 3600 - index, "delivered", index),
		);
		stubOverviewApi({ deliveries: entries });

		const overview = await loadDeliveryOverview("24h");

		if (overview.kind !== "data") {
			throw new Error(`expected data, got ${overview.kind}`);
		}
		expect(overview.full).toBe(false);
		expect(
			overview.timeline.buckets.every(
				(bucket) => bucket.state === "complete",
			),
		).toBe(true);
	});

	it("answers disabled, without a log line, when the server keeps no log", async () => {
		const log = spyOn(console, "error").mockImplementation(() => {});
		stubOverviewApi({ deliveries: 404 });

		const overview = await loadDeliveryOverview("24h");

		expect(overview).toEqual({ kind: "disabled" });
		expect(log).not.toHaveBeenCalled();
		log.mockRestore();
	});

	it("answers unreachable and logs a fixed name when the API fails", async () => {
		const log = spyOn(console, "error").mockImplementation(() => {});
		stubOverviewApi({ deliveries: 500 });

		const overview = await loadDeliveryOverview("24h");

		expect(overview).toEqual({ kind: "unreachable" });
		expect(log).toHaveBeenCalledTimes(1);
		expect(String(log.mock.calls[0]?.[0])).toBe(
			"overview deliveries failed: status=500 code=not_found",
		);
		log.mockRestore();
	});

	it("answers unreachable, and does not throw, when the API cannot be reached", async () => {
		const log = spyOn(console, "error").mockImplementation(() => {});
		stubFetchReject();

		const overview = await loadDeliveryOverview("30d");

		expect(overview).toEqual({ kind: "unreachable" });
		expect(String(log.mock.calls[0]?.[0])).toStartWith(
			"overview deliveries failed:",
		);
		log.mockRestore();
	});
});
