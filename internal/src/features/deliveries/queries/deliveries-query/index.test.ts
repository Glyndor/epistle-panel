import { describe, expect, it } from "bun:test";

import {
	DELIVERIES_REFRESH_MS,
	deliveriesKeys,
	deliveriesQueryOptions,
} from ".";

describe("deliveriesKeys", () => {
	it("keys a list by its filters in a fixed order, null for an absent one", () => {
		expect(deliveriesKeys.list({})).toEqual([
			"deliveries",
			"list",
			null,
			null,
			null,
		]);
		expect(
			deliveriesKeys.list({
				outcome: "failed",
				since: "1h",
				recipient: "a@b.org",
			}),
		).toEqual(["deliveries", "list", "failed", "1h", "a@b.org"]);
		expect(deliveriesKeys.all).toEqual(["deliveries"]);
	});

	it("gives different filters different keys", () => {
		expect(deliveriesKeys.list({ outcome: "failed" })).not.toEqual(
			deliveriesKeys.list({ since: "1h" }),
		);
	});
});

describe("deliveriesQueryOptions", () => {
	it("polls only while the tab is in view", () => {
		const options = deliveriesQueryOptions({}, async () => ({
			entries: [],
			logDisabled: false,
			full: false,
		}));
		expect(options.refetchInterval).toBe(DELIVERIES_REFRESH_MS);
		expect(options.refetchIntervalInBackground).toBe(false);
	});

	it("fetches with its own filters", async () => {
		const seen: unknown[] = [];
		const options = deliveriesQueryOptions(
			{ outcome: "failed" },
			async (filters) => {
				seen.push(filters);
				return { entries: [], logDisabled: false, full: false };
			},
		);
		await (options.queryFn as () => Promise<unknown>)();
		expect(seen).toEqual([{ outcome: "failed" }]);
	});
});
