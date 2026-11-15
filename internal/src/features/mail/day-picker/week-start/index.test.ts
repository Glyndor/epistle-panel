import { describe, expect, it } from "bun:test";

import { firstDayOfWeek } from ".";

describe("firstDayOfWeek", () => {
	it("starts on Sunday in English and Portuguese", () => {
		expect(firstDayOfWeek("en")).toBe(0);
		expect(firstDayOfWeek("pt")).toBe(0);
	});

	it("starts on Monday in Spanish, French, German and Italian", () => {
		for (const locale of ["es", "fr", "de", "it"]) {
			expect([locale, firstDayOfWeek(locale)]).toEqual([locale, 1]);
		}
	});

	it("follows the region when the tag names one", () => {
		expect(firstDayOfWeek("en-GB")).toBe(1);
		expect(firstDayOfWeek("es-MX")).toBe(0);
	});

	it("starts on Monday for a tag the runtime cannot read", () => {
		expect(firstDayOfWeek("not a tag")).toBe(1);
		expect(firstDayOfWeek("")).toBe(1);
	});
});
