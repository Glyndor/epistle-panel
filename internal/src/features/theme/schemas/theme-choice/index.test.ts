import { describe, expect, it } from "bun:test";

import { HOSTILE_THEME_VALUES } from "@/features/theme/test-support/hostile-choices";
import { themeChoiceSchema } from ".";

describe("themeChoiceSchema", () => {
	it("accepts each choice as it is", () => {
		for (const choice of ["system", "light", "dark"]) {
			expect(themeChoiceSchema.parse(choice)).toBe(choice as never);
		}
	});

	it("refuses every other value, and a value that is not a string", () => {
		for (const value of [
			...HOSTILE_THEME_VALUES,
			undefined,
			null,
			1,
			["dark"],
			{ value: "dark" },
		]) {
			expect(themeChoiceSchema.safeParse(value).success).toBe(false);
		}
	});
});
