import { describe, expect, it } from "bun:test";

import { removedAddressSchema, suppressionPageSchema } from ".";

describe("suppressionPageSchema", () => {
	it("parses a page with a cursor", () => {
		const parsed = suppressionPageSchema.parse({
			addresses: ["a@example.org", "b@example.org"],
			next_cursor: "b@example.org",
		});
		expect(parsed.addresses).toHaveLength(2);
		expect(parsed.next_cursor).toBe("b@example.org");
	});

	it("parses the last page, which carries no cursor", () => {
		expect(
			suppressionPageSchema.parse({ addresses: [] }).next_cursor,
		).toBeUndefined();
	});

	it("rejects a page without addresses or with a non-string address", () => {
		for (const body of [
			{},
			{ addresses: [1] },
			{ addresses: "a@b" },
			null,
		]) {
			expect(() => suppressionPageSchema.parse(body)).toThrow();
		}
	});
});

describe("removedAddressSchema", () => {
	it("needs the removed address as a string", () => {
		expect(removedAddressSchema.parse({ removed: "a@b.org" }).removed).toBe(
			"a@b.org",
		);
		expect(() => removedAddressSchema.parse({ removed: 5 })).toThrow();
		expect(() => removedAddressSchema.parse({})).toThrow();
	});
});
