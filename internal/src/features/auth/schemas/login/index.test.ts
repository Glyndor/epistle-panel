import { describe, expect, it } from "bun:test";

import { LOGIN_NAME_MAX, LOGIN_PASSWORD_MAX, loginSchema } from ".";

const parse = (input: unknown) => loginSchema.safeParse(input);
const messages = (input: unknown) => {
	const result = parse(input);
	return result.success
		? []
		: result.error.issues.map((i) => `${i.path.join(".")}:${i.message}`);
};

describe("loginSchema", () => {
	it("accepts a name and a password and trims the name only", () => {
		const result = parse({ name: "  ops\t", password: " pw " });

		expect(result.success && result.data).toEqual({
			name: "ops",
			password: " pw ",
		});
	});

	it("names the field and the reason for an empty name or password", () => {
		expect(messages({ name: "", password: "x" })).toEqual([
			"name:nameRequired",
		]);
		expect(messages({ name: "   ", password: "x" })).toEqual([
			"name:nameRequired",
		]);
		expect(messages({ name: "ops", password: "" })).toEqual([
			"password:passwordRequired",
		]);
		expect(messages({ name: "", password: "" })).toEqual([
			"name:nameRequired",
			"password:passwordRequired",
		]);
	});

	it("caps the name and the password at their limits, to the character", () => {
		expect(
			parse({ name: "a".repeat(LOGIN_NAME_MAX), password: "p" }).success,
		).toBe(true);
		expect(
			messages({ name: "a".repeat(LOGIN_NAME_MAX + 1), password: "p" }),
		).toEqual(["name:nameTooLong"]);
		expect(
			parse({ name: "n", password: "p".repeat(LOGIN_PASSWORD_MAX) })
				.success,
		).toBe(true);
		expect(
			messages({
				name: "n",
				password: "p".repeat(LOGIN_PASSWORD_MAX + 1),
			}),
		).toEqual(["password:passwordTooLong"]);
		expect(LOGIN_NAME_MAX).toBe(254);
		expect(LOGIN_PASSWORD_MAX).toBe(1024);
	});

	it("measures the name after trimming", () => {
		expect(
			parse({ name: ` ${"a".repeat(LOGIN_NAME_MAX)} `, password: "p" })
				.success,
		).toBe(true);
	});

	it("refuses anything that is not two strings", () => {
		for (const input of [
			null,
			undefined,
			"x",
			{},
			{ name: "n" },
			{ name: "n", password: 5 },
			{ name: new File([""], "f"), password: "p" },
			{ name: ["n"], password: "p" },
		]) {
			expect(parse(input).success).toBe(false);
		}
	});
});
