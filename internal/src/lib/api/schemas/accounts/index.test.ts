import { describe, expect, it } from "bun:test";

import { accountsSchema } from ".";

const alice = {
	name: "alice",
	display_name: "Alice A.",
	addresses: ["alice@example.org"],
	dynamic: true,
};

describe("accountsSchema", () => {
	it("parses accounts with a display name, addresses and the dynamic flag", () => {
		const parsed = accountsSchema.parse({
			accounts: [alice, { ...alice, display_name: null, dynamic: false }],
		});
		expect(parsed.accounts[0]?.name).toBe("alice");
		expect(parsed.accounts[0]?.display_name).toBe("Alice A.");
		expect(parsed.accounts[1]?.display_name).toBeNull();
		expect(parsed.accounts[1]?.dynamic).toBe(false);
	});

	it("rejects an account without a name, or without the fields the API always sends", () => {
		for (const account of [
			{ ...alice, name: undefined },
			{ ...alice, display_name: undefined },
			{ ...alice, dynamic: undefined },
			{ ...alice, dynamic: "yes" },
			{ ...alice, display_name: 5 },
		]) {
			expect(() =>
				accountsSchema.parse({ accounts: [account] }),
			).toThrow();
		}
	});
});
