import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";

import {
	pageCursor,
	stubOverviewApi,
} from "@/features/overview/test-support/api";
import { sentRequests, stubFetchReject } from "@/lib/api/test-support/fetch";
import { useFakeClock, useRealClock } from "@/test/fake-clock";

import { loadQueueOverview } from ".";

const originalFetch = globalThis.fetch;

/** Version 7 ids made at the fake clock's start and three hours before it. */
const MADE_NOW = "01a3185c-5000-7abc-8def-0123456789ab";
const MADE_3_H_AGO = "01a317b7-8480-7abc-9def-0123456789ab";

const message = (id: string, recipients = 1) => ({
	id,
	recipients: Array.from(
		{ length: recipients },
		(_, i) => `r${i}@example.net`,
	),
});
const queries = () =>
	sentRequests().map((request) => new URL(request.url).search);

beforeEach(() => {
	useFakeClock();
});
afterEach(() => {
	useRealClock();
	globalThis.fetch = originalFetch;
});

describe("loadQueueOverview", () => {
	it("reads a short queue in one call of 100 and counts it by waiting time", async () => {
		stubOverviewApi({
			queue: [[message(MADE_3_H_AGO, 2), message(MADE_NOW)]],
		});

		const overview = await loadQueueOverview();

		expect(queries()).toEqual(["?limit=100"]);
		if (overview.kind !== "data") {
			throw new Error(`expected data, got ${overview.kind}`);
		}
		expect(overview.capped).toBe(false);
		expect(overview.ages.messages).toBe(2);
		expect(overview.ages.recipients).toBe(3);
		expect(overview.ages.parts.map((part) => part.count)).toEqual([
			1, 1, 0, 0,
		]);
	});

	it("follows the cursor to the last page", async () => {
		stubOverviewApi({
			queue: [
				[message(MADE_NOW)],
				[message(MADE_NOW)],
				[message(MADE_NOW)],
			],
		});

		const overview = await loadQueueOverview();

		expect(queries()).toEqual([
			"?limit=100",
			`?limit=100&cursor=${pageCursor(1)}`,
			`?limit=100&cursor=${pageCursor(2)}`,
		]);
		expect(overview).toMatchObject({ kind: "data", capped: false });
		expect(overview.kind === "data" && overview.ages.messages).toBe(3);
	});

	it("stops after five pages and says the queue holds more", async () => {
		stubOverviewApi({
			queue: Array.from({ length: 7 }, () => [message(MADE_NOW)]),
		});

		const overview = await loadQueueOverview();

		expect(sentRequests()).toHaveLength(5);
		expect(overview).toMatchObject({ kind: "data", capped: true });
		expect(overview.kind === "data" && overview.ages.messages).toBe(5);
	});

	it("is not capped when the fifth page is the last", async () => {
		stubOverviewApi({
			queue: Array.from({ length: 5 }, () => [message(MADE_NOW)]),
		});

		const overview = await loadQueueOverview();

		expect(sentRequests()).toHaveLength(5);
		expect(overview).toMatchObject({ kind: "data", capped: false });
	});

	it("is an empty queue, not a failure, when the API lists nothing", async () => {
		stubOverviewApi({ queue: [[]] });

		const overview = await loadQueueOverview();

		expect(overview).toMatchObject({ kind: "data", capped: false });
		expect(overview.kind === "data" && overview.ages.messages).toBe(0);
	});

	it("answers unreachable and logs a fixed name when the API cannot be reached", async () => {
		const log = spyOn(console, "error").mockImplementation(() => {});
		stubFetchReject();

		const overview = await loadQueueOverview();

		expect(overview).toEqual({ kind: "unreachable" });
		expect(String(log.mock.calls[0]?.[0])).toStartWith(
			"overview queue failed:",
		);
		log.mockRestore();
	});
});
