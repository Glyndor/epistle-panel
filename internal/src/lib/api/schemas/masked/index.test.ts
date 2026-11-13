import { describe, expect, it } from "bun:test";

import {
	maskedAddressSchema,
	maskedCreatedSchema,
	maskedListSchema,
	maskedRemovedSchema,
} from ".";

describe("maskedAddressSchema", () => {
	it("accepts what the server mints: a slug, a dot, eight base32 characters, a domain", () => {
		for (const address of [
			"news.abcdefgh@example.org",
			"my-shop.a2b3c4d5@mail.example.org",
			"x1.zzzzzzzz@a.b",
		]) {
			expect([
				address,
				maskedAddressSchema.safeParse(address).success,
			]).toEqual([address, true]);
		}
	});

	it("refuses a path, a header, an upper-case or a short suffix and a missing domain", () => {
		for (const address of [
			"../x.abcdefgh@example.org",
			"news.abcdefgh@example.org/../../status",
			"news.abcdefgh@example.org\n",
			"news.abcdefgh@example.org\r\nX: y",
			"news.ABCDEFGH@example.org",
			"news.abcdefg@example.org",
			"news.abcdefg1@example.org",
			"news.abcdefgh@",
			"news.abcdefgh",
			"-news.abcdefgh@example.org",
			"news..abcdefgh@example.org",
			"news.abcdefgh@-example.org",
			"news.abcdefgh@example.org%2f..",
			`${"a".repeat(250)}.abcdefgh@example.org`,
			"",
		]) {
			expect([
				address,
				maskedAddressSchema.safeParse(address).success,
			]).toEqual([address, false]);
		}
	});
});

describe("masked response schemas", () => {
	it("reads a listing with and without a last use, and the two confirmations", () => {
		const parsed = maskedListSchema.parse({
			addresses: [
				{ address: "a", label: "A", enabled: true, created_at: 1 },
				{
					address: "b",
					label: "B",
					enabled: false,
					created_at: 2,
					last_used_at: 3,
				},
			],
		});
		expect(parsed.addresses[0]?.last_used_at).toBeUndefined();
		expect(parsed.addresses[1]?.last_used_at).toBe(3);
		expect(maskedCreatedSchema.parse({ address: "a" }).address).toBe("a");
		expect(maskedRemovedSchema.parse({ removed: "a" }).removed).toBe("a");
	});

	it("refuses a listing row of the wrong type", () => {
		for (const row of [
			{ address: "a", label: "A", enabled: "yes", created_at: 1 },
			{ address: "a", label: "A", enabled: true, created_at: -1 },
			{ address: "a", label: "A", enabled: true, created_at: 1.5 },
			{ address: "a", label: "A", enabled: true },
		]) {
			expect(
				maskedListSchema.safeParse({ addresses: [row] }).success,
			).toBe(false);
		}
	});
});
