import { describe, expect, it } from "bun:test";

import { SUPPORTED_LOCALES } from "@/i18n/locales";

import { localeSchema } from ".";

describe("localeSchema", () => {
	it("accepts the shipped locales", () => {
		for (const locale of SUPPORTED_LOCALES) {
			expect(localeSchema.parse(locale)).toBe(locale);
		}
	});

	it("rejects everything else, including near misses and non-strings", () => {
		for (const value of [
			"",
			"EN",
			"ja",
			"en ",
			"en-US",
			"PT",
			"pt-BR",
			null,
			1,
			{},
		]) {
			expect(localeSchema.safeParse(value).success).toBe(false);
		}
	});
});
