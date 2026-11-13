import { describe, expect, it } from "bun:test";

import { PASSWORD_MAX } from "@/features/account-detail/schemas/password-form";
import { createAccountInputSchema } from "@/features/accounts/schemas/account-input";
import { ACCOUNT_NAME_PATTERN } from "@/lib/api/account-name-pattern";
import {
	ACCOUNT_NAME_HTML_PATTERN,
	ACCOUNT_NAME_MAX,
	ADDRESSES_MAX,
	createAccountFormSchema,
	splitAddresses,
} from ".";

const PASSWORD = "correct horse battery";
const ok = {
	name: "alice",
	displayName: "",
	addresses: "alice@example.test",
	password: PASSWORD,
};
const firstError = (input: unknown) => {
	const parsed = createAccountFormSchema.safeParse(input);
	return parsed.success ? undefined : parsed.error.issues[0]?.message;
};

describe("splitAddresses", () => {
	it("splits on line breaks, commas, semicolons and spaces, drops blanks and repeats", () => {
		expect(
			splitAddresses(" a@x.test,\nb@x.test; a@x.test \r\n\tc@x.test,, "),
		).toEqual(["a@x.test", "b@x.test", "c@x.test"]);
		expect(splitAddresses("  \n ")).toEqual([]);
	});
});

describe("createAccountFormSchema", () => {
	it("accepts a plain account", () => {
		expect(firstError(ok)).toBeUndefined();
	});

	it("names what is wrong with each field", () => {
		expect(firstError({ ...ok, name: "" })).toBe("nameRequired");
		expect(firstError({ ...ok, name: "Alice" })).toBe("nameInvalid");
		expect(firstError({ ...ok, name: "-alice" })).toBe("nameInvalid");
		expect(firstError({ ...ok, name: "a".repeat(65) })).toBe("nameInvalid");
		expect(firstError({ ...ok, addresses: " \n" })).toBe(
			"addressesRequired",
		);
		expect(firstError({ ...ok, addresses: "alice" })).toBe(
			"addressesInvalid",
		);
		expect(
			firstError({
				...ok,
				addresses: Array.from(
					{ length: ADDRESSES_MAX + 1 },
					(_, i) => `a${i}@x.test`,
				).join("\n"),
			}),
		).toBe("addressesTooMany");
		expect(firstError({ ...ok, password: "short" })).toBe(
			"passwordTooShort",
		);
		expect(firstError({ ...ok, displayName: "a\u0007b" })).toBe(
			"displayNameControl",
		);
	});
});

describe("the three checks of the form agree", () => {
	// Compiled the way a browser compiles a `pattern` attribute: anchored, with
	// the `v` flag. A pattern that is not valid under it is silently ignored.
	const html = new RegExp(`^(?:${ACCOUNT_NAME_HTML_PATTERN})$`, "v");
	const names = [
		"a",
		"alice",
		"a-b-9",
		"9lives",
		"a".repeat(ACCOUNT_NAME_MAX),
		"",
		"-a",
		"Alice",
		"a b",
		"a.b",
		"a/b",
		"ålice",
		"a".repeat(ACCOUNT_NAME_MAX + 1),
	];

	it("the HTML pattern, the form schema and the action schema accept the same names", () => {
		for (const name of names) {
			const byHtml = html.test(name);
			const byPattern = ACCOUNT_NAME_PATTERN.test(name);
			const byForm = createAccountFormSchema.safeParse({
				...ok,
				name,
			}).success;
			const byAction = createAccountInputSchema.safeParse({
				...ok,
				name,
				addresses: ["alice@example.test"],
			}).success;
			expect([name, byHtml, byForm, byAction]).toEqual([
				name,
				byPattern,
				byPattern,
				byPattern,
			]);
		}
	});

	it("the form and the action agree on passwords at each limit", () => {
		for (const password of [
			"a".repeat(11),
			"a".repeat(12),
			"a".repeat(PASSWORD_MAX),
			"a".repeat(PASSWORD_MAX + 1),
			`${PASSWORD}é`,
			`${PASSWORD}\t`,
		]) {
			const byForm = createAccountFormSchema.safeParse({
				...ok,
				password,
			}).success;
			const byAction = createAccountInputSchema.safeParse({
				...ok,
				password,
				addresses: ["alice@example.test"],
			}).success;
			expect([password.length, byForm]).toEqual([
				password.length,
				byAction,
			]);
		}
	});

	it("what the form reads from the addresses field is what the action accepts", () => {
		for (const text of [
			"a@x.test",
			"a@x.test\nb@x.test",
			"a@x.test, a@x.test",
			"a@x.test b@y.test;c@z.test",
		]) {
			expect(
				createAccountInputSchema.safeParse({
					...ok,
					addresses: splitAddresses(text),
				}).success,
			).toBe(
				createAccountFormSchema.safeParse({ ...ok, addresses: text })
					.success,
			);
		}
	});
});
