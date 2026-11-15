import { afterEach, expect, it } from "bun:test";
import { REMOTE_IMAGES_VARIABLE as KEY, readOperatorRemoteImagesMode } from ".";

const saved = process.env[KEY];
afterEach(() => {
	if (saved === undefined) delete process.env[KEY];
	else process.env[KEY] = saved;
});
it("leaves the policy to the person for unset and blank values", () => {
	delete process.env[KEY];
	expect(readOperatorRemoteImagesMode()).toBeNull();
	for (const value of ["", " \t "]) {
		process.env[KEY] = value;
		expect(readOperatorRemoteImagesMode()).toBeNull();
	}
});
it("accepts each exact mode and trims operator whitespace", () => {
	for (const mode of ["ask", "always", "never"] as const)
		for (const value of [mode, ` \t${mode} \n`]) {
			process.env[KEY] = value;
			expect(readOperatorRemoteImagesMode()).toBe(mode);
		}
});
it("refuses case changes and hostile text without echoing the value", () => {
	for (const value of [
		"ASK",
		"Always",
		" nevermore",
		"<script>private-marker</script>",
		"x".repeat(5000),
	]) {
		process.env[KEY] = value;
		expect(readOperatorRemoteImagesMode).toThrow(
			`${KEY} is set to a mode the panel does not support`,
		);
		try {
			readOperatorRemoteImagesMode();
		} catch (error) {
			expect(String(error)).not.toContain(value);
		}
	}
});
