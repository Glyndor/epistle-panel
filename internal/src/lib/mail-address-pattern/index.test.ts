import { describe, expect, it } from "bun:test";

import { mailAddressSchema } from "@/lib/mail-address";
import {
	isMailAddress,
	MAIL_ADDRESS_HTML_PATTERN,
	MAX_ADDRESS_LENGTH,
} from ".";

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

	it("gives a browser the same rule as an input's pattern, which the browser anchors and compiles with the v flag", () => {
		const pattern = new RegExp(`^(?:${MAIL_ADDRESS_HTML_PATTERN})$`, "v");
		// The length is the `maxlength` attribute's part, and an empty field is
		// `required`'s: a pattern is never asked about either.
		const texts = cases.filter(
			(value): value is string =>
				typeof value === "string" &&
				value !== "" &&
				value.length <= MAX_ADDRESS_LENGTH,
		);
		expect(texts.length).toBeGreaterThan(8);
		for (const value of texts) {
			expect([value, pattern.test(value)]).toEqual([
				value,
				isMailAddress(value),
			]);
		}
	});
});
