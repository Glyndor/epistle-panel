import { describe, expect, it } from "bun:test";

import {
	HOSTILE_IDS,
	HOSTILE_NAMES,
} from "@/features/account-detail/test-support/hostile";

import {
	accountInputSchema,
	createMaskedInputSchema,
	displayNameInputSchema,
	passwordInputSchema,
	removeMaskedInputSchema,
	restoreArchivedInputSchema,
} from ".";

const ID = "01890a5d-ac96-774b-b9aa-9be4c3bd6b0e";
const ADDRESS = "news.abcdefgh@example.org";
const PASSWORD = "correct horse battery";

const good: Array<
	[string, { safeParse(input: unknown): { success: boolean } }, object]
> = [
	["account", accountInputSchema, {}],
	["password", passwordInputSchema, { password: PASSWORD }],
	["display name", displayNameInputSchema, { displayName: "Alice" }],
	["create masked", createMaskedInputSchema, { label: "News" }],
	["remove masked", removeMaskedInputSchema, { address: ADDRESS }],
	["restore archived", restoreArchivedInputSchema, { id: ID }],
];

describe("account action inputs", () => {
	for (const [label, schema, rest] of good) {
		describe(label, () => {
			it("accepts exactly the account name and its own fields", () => {
				expect(
					schema.safeParse({ name: "alice", ...rest }).success,
				).toBe(true);
			});

			it("refuses every hostile account name", () => {
				for (const name of HOSTILE_NAMES) {
					expect([
						name,
						schema.safeParse({ name, ...rest }).success,
					]).toEqual([name, false]);
				}
			});

			it("refuses a missing name, an extra field and a non-object", () => {
				expect(schema.safeParse(rest).success).toBe(false);
				expect(
					schema.safeParse({ name: "alice", ...rest, admin: true })
						.success,
				).toBe(false);
				for (const input of [null, undefined, "alice", [], 5]) {
					expect(schema.safeParse(input).success).toBe(false);
				}
			});

			it("refuses a name that is not a string", () => {
				for (const name of [
					5,
					null,
					["alice"],
					{ toString: () => "alice" },
				]) {
					expect(schema.safeParse({ name, ...rest }).success).toBe(
						false,
					);
				}
			});
		});
	}

	it("refuses a masked address or an archive id that is not what the server issues", () => {
		for (const address of [
			"../status",
			`${ADDRESS}/../..`,
			`${ADDRESS}\n`,
			"news.ABCDEFGH@example.org",
			"",
		]) {
			expect(
				removeMaskedInputSchema.safeParse({ name: "alice", address })
					.success,
			).toBe(false);
		}
		for (const id of HOSTILE_IDS) {
			expect(
				restoreArchivedInputSchema.safeParse({ name: "alice", id })
					.success,
			).toBe(false);
		}
	});

	it("applies the password, display-name and label rules inside the action input", () => {
		expect(
			passwordInputSchema.safeParse({ name: "alice", password: "short" })
				.success,
		).toBe(false);
		expect(
			passwordInputSchema.safeParse({
				name: "alice",
				password: `${PASSWORD}é`,
			}).success,
		).toBe(false);
		expect(
			displayNameInputSchema.safeParse({
				name: "alice",
				displayName: "a\nb",
			}).success,
		).toBe(false);
		expect(
			displayNameInputSchema.parse({
				name: "alice",
				displayName: "  A  ",
			}).displayName,
		).toBe("A");
		expect(
			createMaskedInputSchema.safeParse({ name: "alice", label: "---" })
				.success,
		).toBe(false);
	});
});
