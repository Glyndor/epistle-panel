import { describe, expect, it } from "bun:test";

import { deliveryFiltersSchema, parseFilterParams } from ".";

describe("deliveryFiltersSchema", () => {
	it("accepts no filter and every filter", () => {
		expect(deliveryFiltersSchema.safeParse({}).success).toBe(true);
		expect(
			deliveryFiltersSchema.safeParse({
				outcome: "failed",
				since: "24h",
				recipient: "a@b.org",
			}).success,
		).toBe(true);
	});

	it("refuses an unknown outcome or window, a bad recipient, extra fields and non-objects", () => {
		for (const input of [
			{ outcome: "wonky" },
			{ outcome: "FAILED" },
			{ since: "2h" },
			{ since: "../x" },
			{ since: "1e9d" },
			{ since: "24h\n" },
			{ recipient: "nope" },
			{ recipient: "a@b.org\nBcc: c@d.org" },
			{ recipient: `${"a".repeat(300)}@b.org` },
			{ limit: 1000 },
			{ account: "x" },
			null,
			"failed",
			[],
		]) {
			expect(deliveryFiltersSchema.safeParse(input).success).toBe(false);
		}
	});
});

describe("parseFilterParams", () => {
	it("keeps valid values and builds them in a fixed order", () => {
		const filters = parseFilterParams({
			recipient: "a@b.org",
			since: "7d",
			outcome: "deferred",
		});
		expect(filters).toEqual({
			outcome: "deferred",
			since: "7d",
			recipient: "a@b.org",
		});
		expect(Object.keys(filters)).toEqual(["outcome", "since", "recipient"]);
	});

	it("drops each invalid field on its own and keeps the others", () => {
		expect(
			parseFilterParams({
				outcome: "wonky",
				since: "24h",
				recipient: "../x",
			}),
		).toEqual({ since: "24h" });
		expect(parseFilterParams({ outcome: "failed", since: "1e9d" })).toEqual(
			{
				outcome: "failed",
			},
		);
		expect(parseFilterParams({})).toEqual({});
		expect(parseFilterParams({ outcome: "" })).toEqual({});
	});

	it("uses only the first value of a repeated parameter", () => {
		expect(parseFilterParams({ outcome: ["failed", "delivered"] })).toEqual(
			{
				outcome: "failed",
			},
		);
		expect(parseFilterParams({ outcome: ["wonky", "failed"] })).toEqual({});
		expect(parseFilterParams({ since: [] })).toEqual({});
	});

	it("drops line breaks, bidi controls and over-long recipients", () => {
		for (const recipient of [
			"a@b.org\r\n",
			"a‮@b.org",
			`${"a".repeat(255)}@b.org`,
			"%2e%2e%2f@b.org ",
		]) {
			expect(parseFilterParams({ recipient })).toEqual({});
		}
	});
});
