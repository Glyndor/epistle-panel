import { describe, expect, it } from "bun:test";

import {
	DEFAULT_LOCALE,
	isSupportedLocale,
	LOCALE_COOKIE,
	LOCALE_NAMES,
	SUPPORTED_LOCALES,
} from ".";

describe("locales", () => {
	it("ships six locales, English first", () => {
		expect([...SUPPORTED_LOCALES]).toEqual([
			"en",
			"es",
			"pt",
			"fr",
			"de",
			"it",
		]);
		expect(DEFAULT_LOCALE).toBe("en");
		expect(LOCALE_COOKIE).toBe("locale");
	});

	it("names every locale in its own language, once", () => {
		expect(Object.keys(LOCALE_NAMES).sort()).toEqual(
			[...SUPPORTED_LOCALES].sort(),
		);
		expect(new Set(Object.values(LOCALE_NAMES)).size).toBe(
			SUPPORTED_LOCALES.length,
		);
	});

	it("accepts only the shipped locales, exactly", () => {
		for (const value of SUPPORTED_LOCALES) {
			expect(isSupportedLocale(value)).toBe(true);
		}
		for (const value of [
			undefined,
			"",
			"EN",
			"PT",
			"en-US",
			"pt-BR",
			"ja",
			"es ",
			"../en",
			"constructor",
			"toString",
		]) {
			expect(isSupportedLocale(value)).toBe(false);
		}
	});
});
