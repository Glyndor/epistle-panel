import { afterEach, describe, expect, it } from "bun:test";

import { stubFetchJson } from "@/lib/api/test-support/fetch";

import { loadStatus } from ".";

const originalFetch = globalThis.fetch;
afterEach(() => {
	globalThis.fetch = originalFetch;
});

describe("loadStatus", () => {
	it("keeps the four counters under the interface's names", async () => {
		stubFetchJson({
			version: "1.2.3",
			domains: 2,
			accounts: 5,
			queue_size: 7,
		});

		expect(await loadStatus()).toEqual({
			version: "1.2.3",
			domains: 2,
			accounts: 5,
			queueSize: 7,
		});
	});
});
