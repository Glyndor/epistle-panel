import { describe, expect, it } from "bun:test";

import { ACCOUNT_NAME_MAX, accountNameSchema, parseAccountNameParam } from ".";

describe("accountNameSchema", () => {
	it("accepts a stored account name", () => {
		expect(String(accountNameSchema.parse("torre-control"))).toBe(
			"torre-control",
		);
		expect(ACCOUNT_NAME_MAX).toBe(64);
		expect(accountNameSchema.safeParse("a".repeat(64)).success).toBe(true);
		expect(accountNameSchema.safeParse("a".repeat(65)).success).toBe(false);
	});

	it("refuses a path, an escape, a header and a look-alike letter", () => {
		for (const name of [
			"..",
			"a/b",
			"%2e%2e",
			"a%2fb",
			"Alice",
			"é",
			"a\nb",
			"a b",
			"",
		]) {
			expect([name, accountNameSchema.safeParse(name).success]).toEqual([
				name,
				false,
			]);
		}
	});
});

describe("parseAccountNameParam", () => {
	it("returns the name for a good parameter and nothing for a bad, repeated or missing one", () => {
		expect(String(parseAccountNameParam("alice"))).toBe("alice");
		expect(parseAccountNameParam("../alice")).toBeUndefined();
		expect(parseAccountNameParam(["alice", "bob"])).toBeUndefined();
		expect(parseAccountNameParam(["alice"])).toBeUndefined();
		expect(parseAccountNameParam(undefined)).toBeUndefined();
	});
});
