import { describe, expect, it } from "bun:test";

import { accountsSchema } from ".";

describe("accountsSchema", () => {
	it("parses accounts with addresses", () => {
		const parsed = accountsSchema.parse({
			accounts: [{ name: "alice", addresses: ["alice@example.org"] }],
		});
		expect(parsed.accounts[0]?.name).toBe("alice");
	});

	it("rejects accounts without a name", () => {
		expect(() =>
			accountsSchema.parse({ accounts: [{ addresses: [] }] }),
		).toThrow();
	});
});
