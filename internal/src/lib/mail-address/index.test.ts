import { describe, expect, it } from "bun:test";

import { MAX_ADDRESS_LENGTH, mailAddressSchema, parseAddressParam } from ".";

const accepted = [
	"bob@example.net",
	"a@b",
	"first.last+tag@sub.example.org",
	"o'brien@example.org",
	"a/b@example.org",
	"a%2fb@example.org",
	"..@example.org",
	"usuario@ejemplo.es",
	"ñandú@ejemplo.es",
	"用户@例子.广告",
	`${"a".repeat(MAX_ADDRESS_LENGTH - 2)}@b`,
];

const refused = [
	"",
	"@",
	"a@",
	"@b",
	"a",
	"a@@b",
	"a@b@c",
	"a b@example.org",
	"a@exa mple.org",
	" a@b.org",
	"a@b.org ",
	"a@b.org\n",
	"a@b.org\r\nBcc: x@y.org",
	"a\nb@example.org",
	"a\tb@example.org",
	"a\0@b.org",
	"a@b.org ",
	"a\u0085@b.org",
	"a​@b.org",
	"a‮@b.org",
	"﻿a@b.org",
	"a @b.org",
	"a\u{e000}@b.org",
	`${"a".repeat(MAX_ADDRESS_LENGTH - 1)}@b`,
	`${"a".repeat(100_000)}@b.org`,
];

describe("mailAddressSchema", () => {
	for (const value of accepted) {
		it(`accepts ${JSON.stringify(value.slice(0, 40))}`, () => {
			expect(mailAddressSchema.safeParse(value).success).toBe(true);
		});
	}
	for (const value of refused) {
		it(`refuses ${JSON.stringify(value.slice(0, 40))} (${value.length})`, () => {
			expect(mailAddressSchema.safeParse(value).success).toBe(false);
		});
	}

	it("refuses what is not a string", () => {
		for (const value of [undefined, null, 5, {}, [], ["a@b"], true]) {
			expect(mailAddressSchema.safeParse(value).success).toBe(false);
		}
	});

	it("draws the length line at 254 characters", () => {
		const local = "a".repeat(MAX_ADDRESS_LENGTH - 2);
		expect(mailAddressSchema.safeParse(`${local}@b`).success).toBe(true);
		expect(mailAddressSchema.safeParse(`${local}a@b`).success).toBe(false);
	});
});

describe("parseAddressParam", () => {
	it("keeps an address and drops everything else", () => {
		expect(parseAddressParam("bob@example.net")).toBe("bob@example.net");
		for (const value of [
			undefined,
			"",
			"bob",
			"../x",
			"a@b\n",
			[],
			["bad"],
		]) {
			expect(parseAddressParam(value)).toBeUndefined();
		}
	});

	it("uses only the first value of a repeated parameter", () => {
		expect(parseAddressParam(["a@b.org", "c@d.org"])).toBe("a@b.org");
		expect(parseAddressParam(["bad", "c@d.org"])).toBeUndefined();
	});
});
