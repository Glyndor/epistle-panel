import { describe, expect, it } from "bun:test";

import {
	DEFAULT_LOCALE,
	isSupportedLocale,
	LOCALE_COOKIE,
	SUPPORTED_LOCALES,
} from ".";

describe("locales", () => {
	it("ships English and Spanish, English first", () => {
		expect([...SUPPORTED_LOCALES]).toEqual(["en", "es"]);
		expect(DEFAULT_LOCALE).toBe("en");
		expect(LOCALE_COOKIE).toBe("locale");
	});

	it("accepts only the shipped locales, exactly", () => {
		for (const value of ["en", "es"]) {
			expect(isSupportedLocale(value)).toBe(true);
		}
		for (const value of [undefined, "", "EN", "en-US", "fr", "es "]) {
			expect(isSupportedLocale(value)).toBe(false);
		}
	});
});
