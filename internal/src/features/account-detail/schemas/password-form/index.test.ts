import { describe, expect, it } from "bun:test";

import { PASSWORD_ERROR_KEYS, passwordFormSchema, passwordSchema } from ".";

const failure = (value: unknown) => {
	const result = passwordSchema.safeParse(value);
	return result.success
		? undefined
		: result.error.issues.map((i) => i.message);
};

describe("passwordSchema", () => {
	it("accepts 12 to 64 printable ASCII characters, spaces and punctuation included", () => {
		for (const password of [
			"a".repeat(12),
			"a".repeat(64),
			"correct horse battery staple",
			"Tr0ub4dor&3 !\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~",
		]) {
			expect(failure(password)).toBeUndefined();
		}
	});

	it("refuses 11 and 65 characters, naming which bound", () => {
		expect(failure("a".repeat(11))).toEqual(["passwordTooShort"]);
		expect(failure("a".repeat(65))).toEqual(["passwordTooLong"]);
		expect(failure("")).toEqual(["passwordTooShort"]);
	});

	it("refuses anything outside printable ASCII: control characters, accents, emoji", () => {
		for (const password of [
			`${"a".repeat(12)}\n`,
			`${"a".repeat(12)}\t`,
			`${"a".repeat(12)}\0`,
			`${"a".repeat(12)}\x7f`,
			`${"a".repeat(11)}é`,
			`${"a".repeat(11)}\u{1f600}`,
			`${"a".repeat(11)}‮`,
		]) {
			expect(failure(password)).toContain("passwordCharset");
		}
	});

	it("only fails with a key the form can show", () => {
		for (const password of ["a", "a".repeat(70), `${"a".repeat(12)}é`]) {
			for (const key of failure(password) ?? []) {
				expect(PASSWORD_ERROR_KEYS as readonly string[]).toContain(key);
			}
		}
		expect(PASSWORD_ERROR_KEYS as readonly string[]).toContain(
			"passwordRefused",
		);
	});

	it("is the one field of the form, and refuses a form without it", () => {
		expect(
			passwordFormSchema.safeParse({ password: "a".repeat(12) }).success,
		).toBe(true);
		expect(passwordFormSchema.safeParse({}).success).toBe(false);
	});
});
