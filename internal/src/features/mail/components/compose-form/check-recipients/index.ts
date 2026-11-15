import { MAX_RECIPIENTS } from "@/features/mail/schemas/compose-input-limits";
import { parseRecipients } from "@/features/mail/schemas/recipients";

export type RecipientField = "to" | "cc" | "bcc";
export const RECIPIENT_FIELDS: readonly RecipientField[] = ["to", "cc", "bcc"];

/** What is wrong with one field: the pieces that are not addresses, the lack of any, or too many. */
export type RecipientProblem =
	| {
			readonly field: RecipientField;
			readonly kind: "invalid";
			readonly list: string;
	  }
	| { readonly field: "to"; readonly kind: "none" }
	| { readonly field: RecipientField; readonly kind: "tooMany" };

/** The three fields as the composer reads them. */
type ParsedFields = Record<RecipientField, ReturnType<typeof parseRecipients>>;

/**
 * The field where the running count of recipients passes the limit: the one
 * that holds the addresses that took the message over it.
 */
function fieldOver(parsed: ParsedFields, limit: number): RecipientField {
	let running = 0;
	for (const field of RECIPIENT_FIELDS) {
		running += parsed[field].recipients.length;
		if (running > limit) {
			return field;
		}
	}
	return "to";
}

/**
 * Read the three recipient fields as the composer sends them, and say what
 * stops a send or a draft: a piece that is not an address in any field, a
 * message with more recipients than the limit allows (the limit is for the
 * whole message, not for a field), and, for a send only, a message with nobody
 * to go to. The route is the gate and reads them again; this is the fail-fast
 * help.
 */
export function checkRecipients(
	values: Readonly<Record<RecipientField, string>>,
	op: "draft" | "send",
	maxRecipients: number = MAX_RECIPIENTS,
) {
	const parsed = Object.fromEntries(
		RECIPIENT_FIELDS.map((field) => [
			field,
			parseRecipients(values[field]),
		]),
	) as ParsedFields;
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
	if (count > maxRecipients) {
		problems.push({
			field: fieldOver(parsed, maxRecipients),
			kind: "tooMany",
		});
	}
	if (op === "send" && count === 0 && problems.length === 0) {
		problems.push({ field: "to", kind: "none" });
	}
	return { parsed, problems };
}
