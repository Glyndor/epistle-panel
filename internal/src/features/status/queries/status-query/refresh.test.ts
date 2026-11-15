import { expect, it } from "bun:test";

import { statusQueryOptions } from ".";

const fetcher = async () => ({
	version: "1",
	domains: 0,
	accounts: 0,
	queueSize: 0,
});

it("polls at the interval it is given, and at the normal one when it is given none", () => {
	for (const ms of [15_000, 30_000, 45_000]) {
		expect(statusQueryOptions(fetcher, ms).refetchInterval).toBe(ms);
	}
	expect(statusQueryOptions(fetcher).refetchInterval).toBe(15_000);
});
it("still polls only while the tab is in view whatever the interval", () => {
	expect(
		statusQueryOptions(fetcher, 30_000).refetchIntervalInBackground,
	).toBe(false);
});
