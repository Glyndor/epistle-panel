import { describe, expect, it } from "bun:test";

import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from "@/i18n/locales";

import { localeFromAcceptLanguage, resolveLocale } from ".";

describe("localeFromAcceptLanguage", () => {
	it("answers the language the browser asked for first", () => {
		expect(localeFromAcceptLanguage("es")).toBe("es");
		expect(localeFromAcceptLanguage("de")).toBe("de");
	});

	it("answers the language it wants most, not the first it wrote", () => {
		expect(localeFromAcceptLanguage("en;q=0.4,de;q=0.9,fr;q=0.8")).toBe(
			"de",
		);
	});

	it("keeps the order of the header when two languages want the same", () => {
		expect(localeFromAcceptLanguage("pt,es")).toBe("pt");
		expect(localeFromAcceptLanguage("es;q=0.8,pt;q=0.8")).toBe("es");
	});

	it("answers the language of a range that names a region", () => {
		expect(localeFromAcceptLanguage("fr-CH,fr;q=0.9")).toBe("fr");
		expect(localeFromAcceptLanguage("es-419")).toBe("es");
		expect(localeFromAcceptLanguage("pt-BR")).toBe("pt");
	});

	it("answers nothing for a language the panel does not ship", () => {
		expect(localeFromAcceptLanguage("ja")).toBeUndefined();
		expect(localeFromAcceptLanguage("ja-JP,ko;q=0.8")).toBeUndefined();
	});

	it("answers nothing for a wildcard, which asks for anything", () => {
		expect(localeFromAcceptLanguage("*")).toBeUndefined();
		expect(localeFromAcceptLanguage("*;q=0.5,de;q=0.1")).toBe("de");
	});

	it("skips a language nobody wants", () => {
		expect(localeFromAcceptLanguage("de;q=0,es;q=0.5")).toBe("es");
		expect(localeFromAcceptLanguage("de;q=0")).toBeUndefined();
	});

	it("skips a language whose quality nobody can read", () => {
		for (const header of [
			"de;q=abc",
			"de;q=",
			"de;q=1.5",
			"de;q=-0.5",
			"de;q=0.1234",
			"de;q=.",
		]) {
			expect(localeFromAcceptLanguage(header), header).toBeUndefined();
		}
	});

	it("answers the language it wants most when another one carries a broken quality", () => {
		expect(localeFromAcceptLanguage("de;q=abc,es;q=0.5")).toBe("es");
	});

	it("ignores a parameter that is not a quality", () => {
		expect(localeFromAcceptLanguage("de;level=1")).toBe("de");
		expect(localeFromAcceptLanguage("de;q=1;x=2")).toBe("de");
	});

	it("answers nothing when the header is empty or missing", () => {
		expect(localeFromAcceptLanguage(undefined)).toBeUndefined();
		expect(localeFromAcceptLanguage("")).toBeUndefined();
		expect(localeFromAcceptLanguage("   ")).toBeUndefined();
		expect(localeFromAcceptLanguage(",,,")).toBeUndefined();
	});

	it("reads a header of a thousand languages without slowing down", () => {
		const entries = Array.from({ length: 1000 }, (_, i) =>
			i === 999 ? "de" : "ja",
		);

		const started = Date.now();
		const locale = localeFromAcceptLanguage(entries.join(","));
		const elapsed = Date.now() - started;

		// The thousandth language is past the cap, so it is never read.
		expect(locale).toBeUndefined();
		expect(elapsed).toBeLessThan(1000);
	});

	it("reads a very long header without slowing down", () => {
		const header = "ja-JP;q=0.9,".repeat(100_000);

		const started = Date.now();
		const locale = localeFromAcceptLanguage(header);
		const elapsed = Date.now() - started;

		expect(locale).toBeUndefined();
		expect(elapsed).toBeLessThan(1000);
	});

	it("reads no further than the length of the header", () => {
		// The first range is longer than the header the panel reads, so the
		// language behind it is never read.
		const header = `ja-${"a".repeat(5000)},de`;

		expect(localeFromAcceptLanguage(header)).toBeUndefined();
	});

	it("still answers the language of a very long header that starts with one", () => {
		const header = `es,${"ja,".repeat(100_000)}`;

		expect(localeFromAcceptLanguage(header)).toBe("es");
	});
	it("counts invalid and empty input ranges toward the exact 64-range cap", () => {
		expect(localeFromAcceptLanguage(`${"ja,".repeat(63)}de`)).toBe("de");
		for (const prefix of ["ja,", ",", "ja;q=broken,", "ja;q=0,"]) {
			expect(
				localeFromAcceptLanguage(`${prefix.repeat(64)}de`),
			).toBeUndefined();
		}
	});

	it("caps characters before parsing and never trusts a partially read quality", () => {
		const complete = `${" ".repeat(4090)}de;q=1`;
		expect(complete.length).toBe(4096);
		expect(localeFromAcceptLanguage(complete)).toBe("de");
		expect(localeFromAcceptLanguage(`${complete}.5`)).toBeUndefined();
		expect(
			localeFromAcceptLanguage(`${" ".repeat(4096)}de`),
		).toBeUndefined();
		const million = `es,${"😈,".repeat(400_000)}`;
		expect(million.length).toBeGreaterThan(1_000_000);
		expect(localeFromAcceptLanguage(million)).toBe("es");
		expect(
			localeFromAcceptLanguage(`${"ja;q=bad,".repeat(100_000)}de`),
		).toBeUndefined();
	});

	it("rejects malformed ranges, unicode tricks and ambiguous qualities", () => {
		for (const range of [
			"de-",
			"de-!",
			"de-💥",
			"de-abcdefghi",
			"dé",
			"ＤＥ",
			"de_XX",
			"de/CH",
			"de\\CH",
			"de-\u202e",
			"de;q=0;q=1",
			"de;q=1;q=0",
			"de;q=NaN",
			"de;q=Infinity",
			"de;q=0x1",
			"de;q=１",
			"de;q=1=0",
		]) {
			expect(localeFromAcceptLanguage(range), range).toBeUndefined();
		}
		expect(localeFromAcceptLanguage("DE-ch;Q=0.125,es;q=0.124")).toBe("de");
	});
});

describe("resolveLocale", () => {
	it("answers the person's own choice first", () => {
		expect(resolveLocale("es", "de", "it")).toBe("es");
	});

	it("answers what the browser asked for when the cookie holds nothing usable", () => {
		expect(resolveLocale(undefined, "de", "it")).toBe("de");
		expect(resolveLocale("ja", "de", "it")).toBe("de");
		expect(resolveLocale("es-CO", "de", "it")).toBe("de");
		expect(resolveLocale("", "de", "it")).toBe("de");
	});

	it("answers the operator's default when the browser asked for nothing", () => {
		expect(resolveLocale(undefined, undefined, "it")).toBe("it");
		expect(resolveLocale(undefined, "ja", "it")).toBe("it");
		expect(resolveLocale(undefined, "*", "it")).toBe("it");
	});

	it("answers English when there is neither", () => {
		expect(resolveLocale(undefined, undefined, undefined)).toBe(
			DEFAULT_LOCALE,
		);
		expect(resolveLocale("ja", "ja", undefined)).toBe(DEFAULT_LOCALE);
	});

	it("never believes a cookie that is not a language the panel ships", () => {
		for (const cookie of [
			"__proto__",
			"constructor",
			"toString",
			"en-US",
		]) {
			expect(resolveLocale(cookie, undefined, "it"), cookie).toBe("it");
		}
	});

	it("answers each language the panel ships for its own cookie", () => {
		for (const locale of SUPPORTED_LOCALES) {
			expect(resolveLocale(locale, undefined, undefined)).toBe(locale);
		}
	});
});
