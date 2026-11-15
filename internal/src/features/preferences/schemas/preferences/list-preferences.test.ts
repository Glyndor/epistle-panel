import { expect, it } from "bun:test";
import { preferencesSchema } from ".";

const values = {
	language: "en",
	theme: "system",
	density: "comfortable",
	remoteImages: "ask",
	timeZone: "UTC",
	pageSize: "50",
	refresh: "normal",
} as const;

it("accepts each exact page size and each exact pace", () => {
	for (const pageSize of ["25", "50", "100"] as const)
		expect(preferencesSchema.parse({ ...values, pageSize }).pageSize).toBe(
			pageSize,
		);
	for (const refresh of ["normal", "slow", "fast"] as const)
		expect(preferencesSchema.parse({ ...values, refresh }).refresh).toBe(
			refresh,
		);
});
it("tells a page size that was not sent from one that is not on the list", () => {
	for (const [input, message] of [
		[undefined, "required"],
		[null, "required"],
		["", "required"],
		["10", "notInList"],
		["0", "notInList"],
		["050", "notInList"],
		[" 50", "notInList"],
		["50.0", "notInList"],
		[50, "notInList"],
		[["25", "50"], "notInList"],
		["x".repeat(5000), "notInList"],
	] as const) {
		const result = preferencesSchema.safeParse({
			...values,
			pageSize: input,
		});
		expect(result.success).toBe(false);
		if (!result.success)
			expect(
				result.error.issues.map((issue) => ({
					path: issue.path,
					message: issue.message,
				})),
			).toEqual([{ path: ["pageSize"], message }]);
	}
});
it("tells a pace that was not sent from one that is not on the list, and has no off", () => {
	for (const [input, message] of [
		[undefined, "required"],
		[null, "required"],
		["", "required"],
		["off", "notInList"],
		["never", "notInList"],
		["Fast", "notInList"],
		[" slow", "notInList"],
		[0, "notInList"],
		[["slow", "fast"], "notInList"],
		["x".repeat(5000), "notInList"],
	] as const) {
		const result = preferencesSchema.safeParse({
			...values,
			refresh: input,
		});
		expect(result.success).toBe(false);
		if (!result.success)
			expect(
				result.error.issues.map((issue) => ({
					path: issue.path,
					message: issue.message,
				})),
			).toEqual([{ path: ["refresh"], message }]);
	}
});
