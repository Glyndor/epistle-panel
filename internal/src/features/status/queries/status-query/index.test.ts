import { describe, expect, it } from "bun:test";

import { STATUS_REFRESH_MS, statusKeys, statusQueryOptions } from ".";

describe("statusQueryOptions", () => {
	it("has one key, polls every 15 s, and not while the tab is hidden", () => {
		const options = statusQueryOptions(async () => ({
			version: "1",
			domains: 0,
			accounts: 0,
			queueSize: 0,
		}));

		expect([...options.queryKey]).toEqual(["status"]);
		expect([...options.queryKey]).toEqual([...statusKeys.all]);
		expect(options.refetchInterval).toBe(15_000);
		expect(STATUS_REFRESH_MS).toBe(15_000);
		expect(options.refetchIntervalInBackground).toBe(false);
	});
});
