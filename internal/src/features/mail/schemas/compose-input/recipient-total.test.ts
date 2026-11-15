import { expect, it } from "bun:test";
import { FALLBACK_COMPOSE_LIMITS } from "@/features/mail/schemas/compose-input-limits";
import { composeInputSchema } from ".";

const message = {
	to: [],
	cc: [],
	bcc: [],
	subject: "s",
	text: "t",
	attachments: [],
};
const recipients = (count: number) =>
	Array.from({ length: count }, (_, i) => ({
		email: `person${i}@example.org`,
	}));

it("#255 row 11: rejects a combined 101 recipients for send and draft", () => {
	for (const op of ["draft", "send"]) {
		for (const extra of ["cc", "bcc"]) {
			const result = composeInputSchema(
				FALLBACK_COMPOSE_LIMITS,
			).safeParse({
				...message,
				op,
				to: recipients(100),
				[extra]: recipients(1),
			});
			expect(result.success).toBe(false);
			if (!result.success)
				expect(result.error.issues).toContainEqual(
					expect.objectContaining({ message: "tooManyRecipients" }),
				);
		}
	}
});
it("rejects 300 recipients even though every individual field fits", () => {
	expect(
		composeInputSchema(FALLBACK_COMPOSE_LIMITS).safeParse({
			...message,
			op: "draft",
			to: recipients(100),
			cc: recipients(100),
			bcc: recipients(100),
		}).success,
	).toBe(false);
});
it("accepts exactly 100 recipients spread across all fields", () => {
	for (const op of ["draft", "send"])
		expect(
			composeInputSchema(FALLBACK_COMPOSE_LIMITS).safeParse({
				...message,
				op,
				to: recipients(34),
				cc: recipients(33),
				bcc: recipients(33),
			}).success,
		).toBe(true);
});
it("uses the supplied recipient total limit", () => {
	const schema = composeInputSchema({
		...FALLBACK_COMPOSE_LIMITS,
		maxRecipients: 2,
	});
	expect(
		schema.safeParse({
			...message,
			op: "send",
			to: recipients(1),
			cc: recipients(1),
			bcc: recipients(1),
		}).success,
	).toBe(false);
	expect(
		schema.safeParse({
			...message,
			op: "send",
			cc: recipients(1),
			bcc: recipients(1),
		}).success,
	).toBe(true);
});
