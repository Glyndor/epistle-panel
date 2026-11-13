import { describe, expect, it } from "bun:test";

import { mailAddressSchema } from "@/lib/mail-address";
import { isMailAddress, MAX_ADDRESS_LENGTH } from ".";

describe("isMailAddress", () => {
	const cases: unknown[] = [
		"a@b",
		"alice@example.test",
		"ålice@exämple.test",
		`${"a".repeat(MAX_ADDRESS_LENGTH - 7)}@x.test`,
		`${"a".repeat(MAX_ADDRESS_LENGTH - 6)}@x.test`,
		"",
		"alice",
		"@example.test",
		"alice@",
		"a@b@c",
		"a b@x.test",
		"a@x.test\r\nBcc: e@evil.test",
		"a@x.test\u0000",
		"a@x.test‮",
		7,
		null,
		undefined,
		["a@b"],
	];

	it("agrees with the schema built from it, value by value", () => {
		for (const value of cases) {
			expect([value, isMailAddress(value)]).toEqual([
				value,
				mailAddressSchema.safeParse(value).success,
			]);
		}
	});

	it("accepts an address at the length limit and refuses one past it", () => {
		expect(
			isMailAddress(`${"a".repeat(MAX_ADDRESS_LENGTH - 7)}@x.test`),
		).toBe(true);
		expect(
			isMailAddress(`${"a".repeat(MAX_ADDRESS_LENGTH - 6)}@x.test`),
		).toBe(false);
	});
});
