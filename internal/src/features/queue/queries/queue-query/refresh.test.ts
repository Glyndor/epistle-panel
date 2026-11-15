import { expect, it } from "bun:test";

import { queueQueryOptions } from ".";

const fetcher = async () => ({ entries: [], nextCursor: null });

it("polls at the interval it is given, and at the normal one when it is given none", () => {
	for (const ms of [15_000, 30_000, 45_000]) {
		expect(queueQueryOptions(undefined, fetcher, ms).refetchInterval).toBe(
			ms,
		);
	}
	expect(queueQueryOptions(undefined, fetcher).refetchInterval).toBe(15_000);
});
it("still polls only while the tab is in view whatever the interval", () => {
	expect(
		queueQueryOptions(undefined, fetcher, 30_000)
			.refetchIntervalInBackground,
	).toBe(false);
});
