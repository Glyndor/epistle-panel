import { describe, expect, it } from "bun:test";

import { HOSTILE_DENSITY_VALUES } from "@/features/mail/test-support/hostile-densities";

import { listDensitySchema } from ".";

describe("listDensitySchema", () => {
	it("takes each density", () => {
		expect(listDensitySchema.safeParse("comfortable").success).toBe(true);
		expect(listDensitySchema.safeParse("compact").success).toBe(true);
	});

	it("refuses anything else", () => {
		for (const value of [
			...HOSTILE_DENSITY_VALUES,
			undefined,
			null,
			1,
			["compact"],
		]) {
			expect(listDensitySchema.safeParse(value).success).toBe(false);
		}
	});
});
