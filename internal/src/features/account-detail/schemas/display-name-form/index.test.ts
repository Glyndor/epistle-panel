import { describe, expect, it } from "bun:test";

import {
	DISPLAY_NAME_ERROR_KEYS,
	displayNameFormSchema,
	displayNameSchema,
} from ".";

const parse = (value: unknown) => displayNameSchema.safeParse(value);

describe("displayNameSchema", () => {
	it("trims, and accepts an empty name, which clears it", () => {
		expect(parse("  Alice A.  ")).toMatchObject({
			success: true,
			data: "Alice A.",
		});
		expect(parse("")).toMatchObject({ success: true, data: "" });
		expect(parse("   ")).toMatchObject({ success: true, data: "" });
	});

	it("keeps any script and case as written", () => {
		for (const name of [
			"Ålice",
			"Алиса",
			"山田 太郎",
			"ALICE",
			"ا",
			"🙂 Alice",
		]) {
			expect(parse(name)).toMatchObject({ success: true, data: name });
		}
	});

	it("counts 128 characters by code point, as the server does", () => {
		expect(parse("a".repeat(128)).success).toBe(true);
		expect(parse("a".repeat(129)).success).toBe(false);
		// 128 emoji are 256 UTF-16 units and still 128 characters.
		expect(parse("\u{1f600}".repeat(128)).success).toBe(true);
		expect(parse("\u{1f600}".repeat(129)).success).toBe(false);
	});

	it("refuses control characters and line breaks, which could split the From header", () => {
		for (const name of [
			"a\nb",
			"a\r\nBcc: x@y",
			"a\tb",
			"a\0b",
			"a\x7fb",
			"a\u0085b",
		]) {
			const result = parse(name);
			expect(result.success).toBe(false);
			expect(
				result.success ? [] : result.error.issues.map((i) => i.message),
			).toContain("displayNameControl");
		}
	});

	it("only fails with a key the form can show", () => {
		for (const name of ["a".repeat(200), "a\nb"]) {
			const result = parse(name);
			for (const issue of result.success ? [] : result.error.issues) {
				expect(DISPLAY_NAME_ERROR_KEYS as readonly string[]).toContain(
					issue.message,
				);
			}
		}
		expect(
			displayNameFormSchema.safeParse({ displayName: "A" }).success,
		).toBe(true);
		expect(displayNameFormSchema.safeParse({}).success).toBe(false);
	});
});
