import { afterEach, expect, it } from "bun:test";
import { REFRESH_VARIABLE as KEY, readOperatorRefreshPace } from ".";

const saved = process.env[KEY];
afterEach(() => {
	if (saved === undefined) delete process.env[KEY];
	else process.env[KEY] = saved;
});
it("leaves the pace to the person for unset and blank values", () => {
	delete process.env[KEY];
	expect(readOperatorRefreshPace()).toBeNull();
	for (const value of ["", " \t "]) {
		process.env[KEY] = value;
		expect(readOperatorRefreshPace()).toBeNull();
	}
});
it("accepts each exact pace and trims operator whitespace", () => {
	for (const pace of ["normal", "slow", "fast"] as const)
		for (const value of [pace, ` \t${pace} \n`]) {
			process.env[KEY] = value;
			expect(readOperatorRefreshPace()).toBe(pace);
		}
});
it("refuses off, case changes and hostile text without echoing the value", () => {
	for (const value of [
		"off",
		"never",
		"0",
		"Fast",
		"SLOW",
		"normally",
		"<script>private-marker</script>",
		"x".repeat(5000),
	]) {
		process.env[KEY] = value;
		expect(readOperatorRefreshPace).toThrow(
			`${KEY} is set to a pace the panel does not support`,
		);
		try {
			readOperatorRefreshPace();
		} catch (error) {
			expect(String(error)).not.toContain(value);
		}
	}
});
