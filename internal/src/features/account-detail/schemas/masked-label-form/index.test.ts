import { describe, expect, it } from "bun:test";

import {
	MASKED_LABEL_ERROR_KEYS,
	maskedLabelFormSchema,
	maskedLabelSchema,
} from ".";

const messages = (value: unknown) => {
	const result = maskedLabelSchema.safeParse(value);
	return result.success
		? undefined
		: result.error.issues.map((i) => i.message);
};

describe("maskedLabelSchema", () => {
	it("accepts a label with a letter or a digit, and trims it", () => {
		expect(maskedLabelSchema.parse("  My shop  ")).toBe("My shop");
		for (const label of ["a", "7", "Café 24", "x".repeat(64)]) {
			expect(messages(label)).toBeUndefined();
		}
	});

	it("refuses an empty label, one with no ASCII letter or digit, and one over 64 characters", () => {
		expect(messages("")).toContain("labelRequired");
		expect(messages("   ")).toContain("labelRequired");
		expect(messages("---")).toContain("labelNeedsLetter");
		expect(messages("é")).toContain("labelNeedsLetter");
		expect(messages("x".repeat(65))).toEqual(["labelTooLong"]);
	});

	it("refuses control characters and line breaks", () => {
		for (const label of ["a\nb", "a\r\nb", "a\0", "a\tb"]) {
			expect(messages(label)).toContain("labelControl");
		}
	});

	it("only fails with a key the form can show", () => {
		for (const label of ["", "---", "x".repeat(99), "a\nb"]) {
			for (const key of messages(label) ?? []) {
				expect(MASKED_LABEL_ERROR_KEYS as readonly string[]).toContain(
					key,
				);
			}
		}
		expect(maskedLabelFormSchema.safeParse({ label: "a" }).success).toBe(
			true,
		);
		expect(maskedLabelFormSchema.safeParse({}).success).toBe(false);
	});
});
