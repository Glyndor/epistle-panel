import { describe, expect, it } from "bun:test";

import { HOSTILE_LOCALE_VALUES } from "@/features/locale/test-support/hostile-locales";
import { LIST_DENSITIES } from "@/features/mail/config/list-density";
import { HOSTILE_DENSITY_VALUES } from "@/features/mail/test-support/hostile-densities";
import { THEME_CHOICES } from "@/features/theme/config/choices";
import { HOSTILE_THEME_VALUES } from "@/features/theme/test-support/hostile-choices";
import { SUPPORTED_LOCALES } from "@/i18n/locales";

import {
	isPreferenceErrorKey,
	PREFERENCE_ERROR_KEYS,
	preferencesSchema,
} from ".";

const valid = { language: "es", theme: "dark", density: "compact" };

/** The message the schema gives a field, or undefined when it takes it. */
function refusalOf(input: unknown, field: "language" | "theme" | "density") {
	const result = preferencesSchema.safeParse(input);
	return result.success
		? undefined
		: result.error.issues.find((issue) => issue.path[0] === field)?.message;
}

describe("preferencesSchema", () => {
	it("takes every choice of every list, exactly as the list spells it", () => {
		for (const language of SUPPORTED_LOCALES) {
			for (const theme of THEME_CHOICES) {
				for (const density of LIST_DENSITIES) {
					const input = { language, theme, density };
					expect(preferencesSchema.parse(input)).toEqual(input);
				}
			}
		}
	});

	it("refuses a value outside its list, naming the field and only that one", () => {
		const hostile = {
			language: HOSTILE_LOCALE_VALUES,
			theme: HOSTILE_THEME_VALUES,
			density: HOSTILE_DENSITY_VALUES,
		} as const;
		for (const field of ["language", "theme", "density"] as const) {
			for (const value of hostile[field]) {
				const input = { ...valid, [field]: value };
				const result = preferencesSchema.safeParse(input);

				expect(result.success).toBe(false);
				const named = result.success
					? []
					: result.error.issues.map((issue) => issue.path[0]);
				expect([field, value.slice(0, 20), named]).toEqual([
					field,
					value.slice(0, 20),
					[field],
				]);
			}
		}
	});

	it("tells a field that was not sent from one that is not a choice", () => {
		for (const field of ["language", "theme", "density"] as const) {
			expect(refusalOf({ ...valid, [field]: undefined }, field)).toBe(
				"required",
			);
			expect(refusalOf({ ...valid, [field]: null }, field)).toBe(
				"required",
			);
			expect(refusalOf({ ...valid, [field]: "" }, field)).toBe(
				"required",
			);
			expect(refusalOf({ ...valid, [field]: "nope" }, field)).toBe(
				"notInList",
			);
			expect(refusalOf({ ...valid, [field]: 1 }, field)).toBe(
				"notInList",
			);
			expect(refusalOf({ ...valid, [field]: ["es", "de"] }, field)).toBe(
				"notInList",
			);
			expect(refusalOf({ ...valid, [field]: {} }, field)).toBe(
				"notInList",
			);
		}
	});

	it("refuses an input that is not an object", () => {
		for (const input of [undefined, null, "es", 1, []]) {
			expect(preferencesSchema.safeParse(input).success).toBe(false);
		}
	});

	it("only ever gives a message that is one of the keys the page translates", () => {
		const result = preferencesSchema.safeParse({
			language: "",
			theme: "x",
			density: undefined,
		});

		expect(result.success).toBe(false);
		const messages = result.success
			? []
			: result.error.issues.map((issue) => issue.message);
		expect(messages).toHaveLength(3);
		for (const message of messages) {
			expect(isPreferenceErrorKey(message)).toBe(true);
		}
	});
});

describe("isPreferenceErrorKey", () => {
	it("is true for the two keys and for nothing else", () => {
		expect([...PREFERENCE_ERROR_KEYS]).toEqual(["required", "notInList"]);
		for (const key of PREFERENCE_ERROR_KEYS) {
			expect(isPreferenceErrorKey(key)).toBe(true);
		}
		for (const value of ["", "Required", "other", undefined, null, 1]) {
			expect(isPreferenceErrorKey(value)).toBe(false);
		}
	});
});
