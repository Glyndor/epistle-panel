import { describe, expect, it } from "bun:test";

import { brandNameSchema } from ".";

describe("brandNameSchema", () => {
	it("accepts a plain name and trims it", () => {
		expect(brandNameSchema.parse("  Acme Mail  ")).toBe("Acme Mail");
		expect(brandNameSchema.parse("Épistolé ✉")).toBe("Épistolé ✉");
	});

	it("rejects an empty or too long name", () => {
		expect(brandNameSchema.safeParse("   ").success).toBe(false);
		expect(brandNameSchema.safeParse("x".repeat(41)).success).toBe(false);
		expect(brandNameSchema.safeParse("x".repeat(40)).success).toBe(true);
	});

	it("rejects control characters, newlines included", () => {
		for (const name of [
			"a\nb",
			"a\tb",
			"a\u0000b",
			"a\u007fb",
			"a\u001bb",
		]) {
			expect(brandNameSchema.safeParse(name).success).toBe(false);
		}
	});
});
