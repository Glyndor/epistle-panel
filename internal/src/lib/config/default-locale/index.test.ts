import { afterEach, describe, expect, it } from "bun:test";

import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from "@/i18n/locales";

import { ConfigError } from "../config-error";

import { DEFAULT_LOCALE_VARIABLE, defaultLocale, readDefaultLocale } from ".";

afterEach(() => {
	delete process.env[DEFAULT_LOCALE_VARIABLE];
});

describe("readDefaultLocale", () => {
	it("reads every language the panel ships", () => {
		for (const locale of SUPPORTED_LOCALES) {
			process.env[DEFAULT_LOCALE_VARIABLE] = locale;

			expect(readDefaultLocale()).toBe(locale);
		}
	});

	it("leaves English when the variable is unset or empty", () => {
		expect(readDefaultLocale()).toBe(DEFAULT_LOCALE);

		process.env[DEFAULT_LOCALE_VARIABLE] = "";

		expect(readDefaultLocale()).toBe(DEFAULT_LOCALE);
	});

	it("refuses a language the panel does not ship", () => {
		for (const value of ["ja", "EN", "en-US", "es-ES", "xx", "0", "null"]) {
			process.env[DEFAULT_LOCALE_VARIABLE] = value;

			expect(() => readDefaultLocale(), value).toThrow(ConfigError);
		}
	});

	it("names the variable and never the value", () => {
		process.env[DEFAULT_LOCALE_VARIABLE] = "klingon";

		expect(() => readDefaultLocale()).toThrow(DEFAULT_LOCALE_VARIABLE);
		try {
			readDefaultLocale();
		} catch (error) {
			expect((error as Error).message).not.toContain("klingon");
		}
	});
});

describe("defaultLocale", () => {
	it("gives the language the operator chose", () => {
		process.env[DEFAULT_LOCALE_VARIABLE] = "de";

		expect(defaultLocale()).toBe("de");
	});

	it("gives English when the variable is unset", () => {
		expect(defaultLocale()).toBe(DEFAULT_LOCALE);
	});

	it("gives English when the variable holds a language the panel does not ship", () => {
		process.env[DEFAULT_LOCALE_VARIABLE] = "ja";

		expect(defaultLocale()).toBe(DEFAULT_LOCALE);
	});
});
