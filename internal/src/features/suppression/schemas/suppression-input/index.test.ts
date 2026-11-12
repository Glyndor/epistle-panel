import { describe, expect, it } from "bun:test";

import { removeAddressInputSchema, suppressionPageInputSchema } from ".";

describe("suppressionPageInputSchema", () => {
	it("accepts no cursor or an address cursor", () => {
		expect(suppressionPageInputSchema.safeParse({}).success).toBe(true);
		expect(
			suppressionPageInputSchema.safeParse({ after: "a@b.org" }).success,
		).toBe(true);
	});

	it("refuses a bad cursor, an unknown field and a non-object", () => {
		for (const input of [
			{ after: "x" },
			{ after: "a@b.org\n" },
			{ after: "a@b.org", limit: 9999 },
			{ after: 5 },
			null,
			"a@b.org",
			[],
			undefined,
		]) {
			expect(suppressionPageInputSchema.safeParse(input).success).toBe(
				false,
			);
		}
	});
});

describe("removeAddressInputSchema", () => {
	it("needs exactly an address", () => {
		expect(
			removeAddressInputSchema.safeParse({ address: "a@b.org" }).success,
		).toBe(true);
		for (const input of [
			{},
			{ address: "" },
			{ address: "../x" },
			{ address: "a@b.org", account: "x@y.org" },
			{ address: ["a@b.org"] },
			"a@b.org",
		]) {
			expect(removeAddressInputSchema.safeParse(input).success).toBe(
				false,
			);
		}
	});
});
