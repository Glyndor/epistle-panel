import { expect, it } from "bun:test";

import { deliveriesQueryOptions } from ".";

const fetcher = async () => ({
	entries: [],
	logDisabled: false,
	full: false,
});

it("polls at the interval it is given, and at the normal one when it is given none", () => {
	for (const ms of [15_000, 60_000, 90_000]) {
		expect(deliveriesQueryOptions({}, fetcher, ms).refetchInterval).toBe(
			ms,
		);
	}
	expect(deliveriesQueryOptions({}, fetcher).refetchInterval).toBe(30_000);
});
it("still polls only while the tab is in view whatever the interval", () => {
	expect(
		deliveriesQueryOptions({}, fetcher, 60_000).refetchIntervalInBackground,
	).toBe(false);
});
