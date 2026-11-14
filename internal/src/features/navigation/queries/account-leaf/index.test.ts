import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";

import { sentRequests, stubFetchJson } from "@/lib/api/test-support/fetch";

const originalFetch = globalThis.fetch;
const { accountLeaf } = await import(".");

beforeEach(() => {
	process.env["EPISTLE_API_URL"] = "http://127.0.0.1:8025";
	process.env["EPISTLE_API_TOKEN"] = "test-token";
});
afterEach(() => {
	globalThis.fetch = originalFetch;
});

const accounts = {
	accounts: [
		{
			name: "alice",
			display_name: null,
			addresses: ["alice@example.org"],
			dynamic: true,
		},
	],
};

describe("accountLeaf", () => {
	it("is the account an address names, once the accounts list says it is one", async () => {
		stubFetchJson(accounts);

		expect(await accountLeaf("alice")).toBe("alice");
	});

	it("is nothing for a name that is not on the list", async () => {
		stubFetchJson(accounts);

		expect(await accountLeaf("bob")).toBeUndefined();
	});

	it("is nothing for a segment that could not be an account's name, and the API is asked nothing", async () => {
		stubFetchJson(accounts);

		for (const segment of [
			"..%2fqueue",
			"../queue",
			"%3Cscript%3E",
			"<script>",
			"Admin",
			"a%0d%0ab",
			"ålice",
			"",
		]) {
			expect([segment, await accountLeaf(segment)]).toEqual([
				segment,
				undefined,
			]);
		}
		expect(sentRequests()).toHaveLength(0);
	});

	it("lets the name stand when the list cannot be read, as the page's heading does", async () => {
		const logged = spyOn(console, "error").mockImplementation(() => {});
		try {
			stubFetchJson({}, 503);

			expect(await accountLeaf("alice")).toBe("alice");
		} finally {
			logged.mockRestore();
		}
	});
});
