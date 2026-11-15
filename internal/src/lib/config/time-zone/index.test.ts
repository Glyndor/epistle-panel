import { afterEach, expect, it } from "bun:test";
import { TIME_ZONE_VARIABLE as KEY, readOperatorTimeZone } from ".";

const saved = process.env[KEY];
afterEach(() => {
	if (saved === undefined) delete process.env[KEY];
	else process.env[KEY] = saved;
});
it("leaves the policy to the person for unset and blank values", () => {
	delete process.env[KEY];
	expect(readOperatorTimeZone()).toBeNull();
	for (const value of ["", " \t "]) {
		process.env[KEY] = value;
		expect(readOperatorTimeZone()).toBeNull();
	}
});
it("accepts each exact mode and trims operator whitespace", () => {
	for (const mode of ["UTC", "America/Bogota", "Pacific/Kiritimati"] as const)
		for (const value of [mode, ` \t${mode} \n`]) {
			process.env[KEY] = value;
			expect(readOperatorTimeZone()).toBe(mode);
		}
});
it("refuses case changes and hostile text without echoing the value", () => {
	for (const value of [
		"utc",
		"Mars/Base",
		"Etc/GMT+14",
		"<script>private-marker</script>",
		"x".repeat(5000),
	]) {
		process.env[KEY] = value;
		expect(readOperatorTimeZone).toThrow(
			`${KEY} is set to a time zone the panel does not know`,
		);
		try {
			readOperatorTimeZone();
		} catch (error) {
			expect(String(error)).not.toContain(value);
		}
	}
});
