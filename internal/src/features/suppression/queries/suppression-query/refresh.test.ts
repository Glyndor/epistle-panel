import { expect, it } from "bun:test";

import { suppressionQueryOptions } from ".";

const fetcher = async () => ({ entries: [], nextCursor: null });

it("polls at the interval it is given, and at the normal one when it is given none", () => {
	for (const ms of [15_000, 60_000, 90_000]) {
		expect(
			suppressionQueryOptions(undefined, fetcher, ms).refetchInterval,
		).toBe(ms);
	}
	expect(suppressionQueryOptions(undefined, fetcher).refetchInterval).toBe(
		30_000,
	);
});
it("still polls only while the tab is in view whatever the interval", () => {
	expect(
		suppressionQueryOptions(undefined, fetcher, 60_000)
			.refetchIntervalInBackground,
	).toBe(false);
});
