import { describe, expect, it } from "bun:test";

import { HOSTILE_THEME_VALUES } from "@/features/theme/test-support/hostile-choices";
import {
	DEFAULT_THEME_CHOICE,
	forcedTheme,
	isThemeChoice,
	parseThemeChoice,
	THEME_ATTRIBUTE,
	THEME_CHOICES,
	THEME_COOKIE,
} from ".";

describe("theme choices", () => {
	it("are system, light and dark, and nothing else", () => {
		expect([...THEME_CHOICES]).toEqual(["system", "light", "dark"]);
		expect(DEFAULT_THEME_CHOICE).toBe("system");
		expect(THEME_COOKIE).toBe("theme");
		expect(THEME_ATTRIBUTE).toBe("data-theme");
	});

	it("accepts each choice, exactly", () => {
		for (const choice of ["system", "light", "dark"]) {
			expect(isThemeChoice(choice)).toBe(true);
			expect(parseThemeChoice(choice)).toBe(choice as never);
		}
	});

	it("reads anything else as no choice", () => {
		for (const value of [
			...HOSTILE_THEME_VALUES,
			undefined,
			null,
			0,
			["dark"],
			{ toString: () => "dark" },
		]) {
			expect(isThemeChoice(value)).toBe(false);
			expect(parseThemeChoice(value)).toBe("system");
		}
	});

	it("pins light and dark on the document, and nothing for system", () => {
		expect(forcedTheme("light")).toBe("light");
		expect(forcedTheme("dark")).toBe("dark");
		expect(forcedTheme("system")).toBeUndefined();
	});
});
