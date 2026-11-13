import { describe, expect, it } from "bun:test";

import { ACCOUNT_NAME_PATTERN, isAccountName } from ".";

describe("isAccountName", () => {
	it("accepts lowercase ASCII letters, digits and inner hyphens up to 64 characters", () => {
		for (const name of [
			"a",
			"0",
			"alice",
			"torre-control",
			"a-",
			`a${"b".repeat(63)}`,
		]) {
			expect([name, isAccountName(name)]).toEqual([name, true]);
		}
	});

	it("refuses every shape that could change an API path or a header", () => {
		for (const name of [
			"",
			"-a",
			`a${"b".repeat(64)}`,
			".",
			"..",
			"../status",
			"a/b",
			"a\\b",
			"a%2fb",
			"%2e%2e",
			"a%00",
			"a\0b",
			"A",
			"alice\n",
			"alice\r\nHost: evil.test",
			"a b",
			"a.b",
			"a@b",
			"a?x=1",
			"a#x",
			"é",
			"ａ",
			"‮a",
			"٣",
		]) {
			expect([name, isAccountName(name)]).toEqual([name, false]);
		}
	});

	it("refuses what is not a string", () => {
		for (const value of [
			undefined,
			null,
			5,
			["a"],
			{ toString: () => "a" },
		]) {
			expect(isAccountName(value)).toBe(false);
		}
		expect(ACCOUNT_NAME_PATTERN.flags).toBe("");
	});
});
