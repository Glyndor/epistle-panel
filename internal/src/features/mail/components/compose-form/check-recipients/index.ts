import { parseRecipients } from "@/features/mail/schemas/recipients";

export type RecipientField = "to" | "cc" | "bcc";
export const RECIPIENT_FIELDS: readonly RecipientField[] = ["to", "cc", "bcc"];

/** What is wrong with one field: the pieces that are not addresses, or the lack of any. */
export type RecipientProblem =
	| {
			readonly field: RecipientField;
			readonly kind: "invalid";
			readonly list: string;
	  }
	| { readonly field: "to"; readonly kind: "none" };

/**
 * Read the three recipient fields as the composer sends them, and say what
 * stops a send or a draft: a piece that is not an address in any field, and,
 * for a send only, a message with nobody to go to. The route is the gate and
 * reads them again; this is the fail-fast help.
 */
export function checkRecipients(
	values: Readonly<Record<RecipientField, string>>,
	op: "draft" | "send",
) {
	const parsed = Object.fromEntries(
		RECIPIENT_FIELDS.map((field) => [
			field,
			parseRecipients(values[field]),
		]),
	) as Record<RecipientField, ReturnType<typeof parseRecipients>>;
	const problems: RecipientProblem[] = [];
	for (const field of RECIPIENT_FIELDS) {
		const { invalid } = parsed[field];
		if (invalid.length > 0) {
			problems.push({ field, kind: "invalid", list: invalid.join(", ") });
		}
	}
	const count = RECIPIENT_FIELDS.reduce(
		(total, field) => total + parsed[field].recipients.length,
		0,
	);
	if (op === "send" && count === 0 && problems.length === 0) {
		problems.push({ field: "to", kind: "none" });
	}
	return { parsed, problems };
}
