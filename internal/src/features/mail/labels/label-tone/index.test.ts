import { describe, expect, it } from "bun:test";

import { labelTone } from ".";

describe("labelTone", () => {
	it("is a tone of the palette, the same one every time", () => {
		for (const key of ["work", "to_20do", "a_c3_b1o", "", "x".repeat(64)]) {
			const tone = labelTone(key);
			expect(tone).toBeGreaterThanOrEqual(1);
			expect(tone).toBeLessThanOrEqual(8);
			expect(Number.isInteger(tone)).toBe(true);
			expect(labelTone(key)).toBe(tone);
		}
	});

	it("gives these keys these tones", () => {
		// Fixed values: a change of the function would recolour every label.
		expect(labelTone("work")).toBe(1);
		expect(labelTone("personal")).toBe(6);
		expect(labelTone("")).toBe(6);
	});

	it("uses every tone over a few hundred keys", () => {
		const seen = new Set<number>();
		for (let n = 0; n < 400; n += 1) {
			seen.add(labelTone(`label-${n}`));
		}
		expect([...seen].sort()).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
	});
});
