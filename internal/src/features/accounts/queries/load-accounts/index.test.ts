import { afterEach, describe, expect, it } from "bun:test";

import { stubFetchJson } from "@/lib/api/test-support/fetch";

import { loadAccounts } from ".";

const originalFetch = globalThis.fetch;
afterEach(() => {
	globalThis.fetch = originalFetch;
});

describe("loadAccounts", () => {
	it("keeps the name, the person's name, the addresses and whether the API manages it", async () => {
		stubFetchJson({
			accounts: [
				{
					name: "ops",
					display_name: "Ops Team",
					addresses: ["ops@example.org"],
					dynamic: true,
				},
				{
					name: "legacy",
					display_name: null,
					addresses: [],
					dynamic: false,
				},
			],
		});

		expect(await loadAccounts()).toEqual([
			{
				name: "ops",
				displayName: "Ops Team",
				addresses: ["ops@example.org"],
				dynamic: true,
			},
			{
				name: "legacy",
				displayName: null,
				addresses: [],
				dynamic: false,
			},
		]);
	});
});
