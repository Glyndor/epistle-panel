import { expect, it } from "bun:test";
import { editablePreferencesSchema, preferencesSchema } from ".";

const values = {
	language: "en",
	theme: "system",
	density: "comfortable",
} as const;
it("requires a fourth exact mode when the preference is editable", () => {
	for (const mode of ["ask", "always", "never"] as const)
		expect(
			preferencesSchema.parse({ ...values, remoteImages: mode })
				.remoteImages,
		).toBe(mode);
	for (const value of [
		undefined,
		null,
		"",
		"ASK",
		" always ",
		"<hostile>",
		1,
		["ask", "never"],
	])
		expect(
			preferencesSchema.safeParse({ ...values, remoteImages: value })
				.success,
		).toBe(false);
});
it("validates the other three fields independently for a fixed operator policy", () => {
	expect(editablePreferencesSchema.parse(values)).toEqual(values);
	expect(
		editablePreferencesSchema.safeParse({ ...values, theme: "hostile" })
			.success,
	).toBe(false);
});
