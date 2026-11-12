import { describe, expect, it } from "bun:test";

import { localeSchema } from ".";

describe("localeSchema", () => {
	it("accepts the shipped locales", () => {
		expect(localeSchema.parse("en")).toBe("en");
		expect(localeSchema.parse("es")).toBe("es");
	});

	it("rejects everything else, including near misses and non-strings", () => {
		for (const value of ["", "EN", "fr", "en ", "en-US", null, 1, {}]) {
			expect(localeSchema.safeParse(value).success).toBe(false);
		}
	});
});
