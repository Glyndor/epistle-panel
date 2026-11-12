import { afterEach, describe, expect, it } from "bun:test";

import { stubFetchJson } from "@/lib/api/test-support/fetch";

import { loadAccounts } from ".";

const originalFetch = globalThis.fetch;
afterEach(() => {
	globalThis.fetch = originalFetch;
});

describe("loadAccounts", () => {
	it("keeps the name and the addresses of each account", async () => {
		stubFetchJson({
			accounts: [{ name: "ops", addresses: ["ops@example.org"] }],
		});

		expect(await loadAccounts()).toEqual([
			{ name: "ops", addresses: ["ops@example.org"] },
		]);
	});
});
