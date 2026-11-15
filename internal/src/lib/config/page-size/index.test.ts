import { afterEach, expect, it } from "bun:test";
import { PAGE_SIZE_VARIABLE as KEY, readOperatorPageSize } from ".";

const saved = process.env[KEY];
afterEach(() => {
	if (saved === undefined) delete process.env[KEY];
	else process.env[KEY] = saved;
});
it("leaves the size to the person for unset and blank values", () => {
	delete process.env[KEY];
	expect(readOperatorPageSize()).toBeNull();
	for (const value of ["", " \t "]) {
		process.env[KEY] = value;
		expect(readOperatorPageSize()).toBeNull();
	}
});
it("accepts each exact size and trims operator whitespace", () => {
	for (const size of ["25", "50", "100"] as const)
		for (const value of [size, ` \t${size} \n`]) {
			process.env[KEY] = value;
			expect(readOperatorPageSize()).toBe(size);
		}
});
it("refuses numbers off the list, other spellings and hostile text without echoing the value", () => {
	for (const value of [
		"0",
		"10",
		"75",
		"101",
		"050",
		"50.0",
		"+50",
		"1e2",
		"-25",
		"fifty",
		"<script>private-marker</script>",
		"x".repeat(5000),
	]) {
		process.env[KEY] = value;
		expect(readOperatorPageSize).toThrow(
			`${KEY} is set to a page size the panel does not support`,
		);
		try {
			readOperatorPageSize();
		} catch (error) {
			expect(String(error)).not.toContain(value);
		}
	}
});
