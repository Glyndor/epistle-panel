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
// Audit 18: JSON.parse creates an own __proto__ key, unlike an object literal.
it.each(["__proto__", "constructor", "prototype"])(
	"rejects the own JSON key %s",
	(key) => {
		const payload = JSON.parse(`{${JSON.stringify(key)}:{"admin":true}}`);
		const parsed = composeInputSchema(FALLBACK_COMPOSE_LIMITS).safeParse({
			...message,
			...payload,
		});
		expect(Object.hasOwn(payload, key)).toBe(true);
		expect(parsed.success).toBe(false);
		if (!parsed.success) {
			expect(parsed.error.issues).toContainEqual(
				expect.objectContaining({
					code: "unrecognized_keys",
					keys: [key],
				}),
			);
		}
		expect(Object.hasOwn(Object.prototype, "admin")).toBe(false);
	},
);
