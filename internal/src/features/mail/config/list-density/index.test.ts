import { describe, expect, it } from "bun:test";

import { HOSTILE_DENSITY_VALUES } from "@/features/mail/test-support/hostile-densities";

import {
	DEFAULT_LIST_DENSITY,
	isListDensity,
	LIST_DENSITIES,
	LIST_DENSITY_ATTRIBUTE,
	LIST_DENSITY_COOKIE,
	parseListDensity,
} from ".";

describe("list density", () => {
	it("has two densities, and comfortable is the one nobody chose", () => {
		expect([...LIST_DENSITIES]).toEqual(["comfortable", "compact"]);
		expect(DEFAULT_LIST_DENSITY).toBe("comfortable");
	});

	it("names its cookie and the attribute the stylesheet's variants read", () => {
		expect(LIST_DENSITY_COOKIE).toBe("mail-density");
		expect(LIST_DENSITY_ATTRIBUTE).toBe("data-density");
	});

	it("takes a density exactly and nothing that only looks like one", () => {
		expect(isListDensity("comfortable")).toBe(true);
		expect(isListDensity("compact")).toBe(true);
		for (const value of HOSTILE_DENSITY_VALUES) {
			expect(isListDensity(value)).toBe(false);
			expect(parseListDensity(value)).toBe("comfortable");
		}
		for (const value of [undefined, null, 1, ["compact"], {}]) {
			expect(parseListDensity(value)).toBe("comfortable");
		}
		expect(parseListDensity("compact")).toBe("compact");
	});
});
