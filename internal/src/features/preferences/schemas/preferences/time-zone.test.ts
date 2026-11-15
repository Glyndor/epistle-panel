import { expect, it } from "bun:test";
import { TIME_ZONES } from "@/features/time-zone/config/zones";
import { preferencesSchema } from ".";

const values = {
	language: "en",
	theme: "system",
	density: "comfortable",
	remoteImages: "ask",
};
it("accepts every exact listed zone and classifies missing and hostile fifth fields", () => {
	for (const zone of TIME_ZONES)
		expect(
			preferencesSchema.parse({ ...values, timeZone: zone }).timeZone,
		).toBe(zone);
	for (const [input, message] of [
		[undefined, "required"],
		["", "required"],
		["Mars/Base", "notInList"],
		["utc", "notInList"],
		[" UTC ", "notInList"],
		["../", "notInList"],
		["x".repeat(5000), "notInList"],
		["Etc/GMT+14", "notInList"],
		[["UTC", "UTC"], "notInList"],
	] as const) {
		const result = preferencesSchema.safeParse({
			...values,
			timeZone: input,
		});
		expect(result.success).toBe(false);
		if (!result.success)
			expect(
				result.error.issues.map((issue) => ({
					path: issue.path,
					message: issue.message,
				})),
			).toEqual([{ path: ["timeZone"], message }]);
	}
});
