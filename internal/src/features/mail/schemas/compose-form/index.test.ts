import { describe, expect, it } from "bun:test";

import { loadMessages } from "@/i18n/messages";
import {
	COMPOSE_SIZE_MESSAGES,
	composeFormSchema,
	isComposeSizeMessage,
} from ".";

const fits = {
	to: "a".repeat(20_000),
	cc: "c".repeat(20_000),
	bcc: "b".repeat(20_000),
	subject: "s".repeat(998),
	text: "t".repeat(1_000_000),
};

describe("composeFormSchema", () => {
	it("takes every field at its limit", () => {
		expect(composeFormSchema.safeParse(fits).success).toBe(true);
	});

	it("refuses each field one character over, with a message the form translates", () => {
		for (const [field, message] of [
			["to", "recipientsTooLong"],
			["cc", "recipientsTooLong"],
			["bcc", "recipientsTooLong"],
			["subject", "subjectTooLong"],
			["text", "bodyTooLong"],
		] as const) {
			const result = composeFormSchema.safeParse({
				...fits,
				[field]: `${fits[field]}x`,
			});
			const messages = result.success
				? []
				: result.error.issues.map((issue) => issue.message);
			expect([field, messages]).toEqual([field, [message]]);
			expect(isComposeSizeMessage(message)).toBe(true);
		}
	});

	it("does not take a sentence for one of its keys", () => {
		expect(isComposeSizeMessage("x@ is not an address")).toBe(false);
		expect(isComposeSizeMessage("")).toBe(false);
	});

	it("has every one of its messages in the catalog", async () => {
		const { mail } = (await loadMessages("en")) as {
			mail: Record<string, string>;
		};
		for (const key of COMPOSE_SIZE_MESSAGES) {
			expect([key, typeof mail[key]]).toEqual([key, "string"]);
		}
	});
});
