import { expect, it } from "bun:test";
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
// Audit 17: names reach MIME address headers, too.
it.each(["to", "cc", "bcc"])(
	"refuses header controls in %s display names",
	(field) => {
		for (const name of ["A\r\nBcc: x@y.org", "A\rB", "A\nB", "A\u0000B"]) {
			const parsed = composeInputSchema.safeParse({
				...message,
				[field]: [{ name, email: "a@b.org" }],
			});
			expect(parsed.success, name).toBe(false);
		}
		expect(
			composeInputSchema.safeParse({
				...message,
				[field]: [{ name: "Ana María", email: "a@b.org" }],
			}).success,
		).toBe(true);
	},
);
