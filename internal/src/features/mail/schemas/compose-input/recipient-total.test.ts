import { expect, it } from "bun:test";
import { FALLBACK_COMPOSE_LIMITS } from "@/features/mail/schemas/compose-input-limits";
import { composeInputSchema } from ".";

const message = {
	op: "draft",
	to: [],
	cc: [],
	bcc: [],
	subject: "s",
	text: "t",
	attachments: [],
};
// Audit 11, REAL DEFECT: 100 applies per field; epistle's message-wide cap is 100.
it("currently accepts 300 recipients distributed across To, Cc and Bcc", () => {
	const recipients = Array.from({ length: 100 }, (_, i) => ({
		email: `person${i}@example.org`,
	}));
	expect(
		composeInputSchema(FALLBACK_COMPOSE_LIMITS).safeParse({
			...message,
			to: recipients,
			cc: recipients,
			bcc: recipients,
		}).success,
	).toBe(true);
	for (const field of ["to", "cc", "bcc"]) {
		expect(
			composeInputSchema(FALLBACK_COMPOSE_LIMITS).safeParse({
				...message,
				[field]: [...recipients, { email: "overflow@example.org" }],
			}).success,
		).toBe(false);
	}
});

// Run with bun test --todo: the panel currently accepts this over-limit message.
it.todo("#255, row 11: refuses more than 100 recipients across all fields", () => {
	const to = Array.from({ length: 100 }, () => ({ email: "a@example.org" }));
	expect(
		composeInputSchema(FALLBACK_COMPOSE_LIMITS).safeParse({
			...message,
			to,
			cc: [{ email: "extra@example.org" }],
		}).success,
	).toBe(false);
});
