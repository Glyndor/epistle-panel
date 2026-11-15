import { describe, expect, it } from "bun:test";
import {
	type ComposeLimits,
	FALLBACK_COMPOSE_LIMITS,
} from "@/features/mail/schemas/compose-input-limits";
import { loadMessages } from "@/i18n/messages";

import {
	COMPOSE_SIZE_MESSAGES,
	composeFormSchema,
	isComposeSizeMessage,
} from ".";

/** The limits the test works with: the panel's own by default. */
const limits: ComposeLimits = FALLBACK_COMPOSE_LIMITS;

const fits = {
	to: "a".repeat(20_000),
	cc: "c".repeat(20_000),
	bcc: "b".repeat(20_000),
	subject: "s".repeat(998),
	text: "t".repeat(1_000_000),
};

describe("composeFormSchema", () => {
	it("takes every field at its limit", () => {
		expect(composeFormSchema(limits).safeParse(fits).success).toBe(true);
	});

	it("refuses each field one character over, with a message the form translates", () => {
		for (const [field, message] of [
			["to", "recipientsTooLong"],
			["cc", "recipientsTooLong"],
			["bcc", "recipientsTooLong"],
			["subject", "subjectTooLong"],
			["text", "bodyTooLong"],
		] as const) {
			const result = composeFormSchema(limits).safeParse({
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

	it("holds the lengths the mail server's limits say, not the panel's own", () => {
		const own: ComposeLimits = {
			...FALLBACK_COMPOSE_LIMITS,
			maxRecipientsText: 40,
			maxSubject: 60,
			maxText: 80,
		};
		const schema = composeFormSchema(own);

		expect(
			schema.safeParse({
				to: "a".repeat(40),
				cc: "",
				bcc: "",
				subject: "s".repeat(60),
				text: "t".repeat(80),
			}).success,
		).toBe(true);
		expect(
			schema.safeParse({
				to: "a".repeat(41),
				cc: "",
				bcc: "",
				subject: "s",
				text: "t",
			}).success,
		).toBe(false);
		expect(
			schema.safeParse({
				to: "",
				cc: "",
				bcc: "",
				subject: "s".repeat(61),
				text: "t",
			}).success,
		).toBe(false);
		expect(
			schema.safeParse({
				to: "",
				cc: "",
				bcc: "",
				subject: "s",
				text: "t".repeat(81),
			}).success,
		).toBe(false);
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
