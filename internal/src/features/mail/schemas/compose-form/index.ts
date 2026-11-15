import * as z from "zod/mini";

import type { ComposeLimits } from "@/features/mail/schemas/compose-input-limits";

/**
 * Every message this schema can give, as a key of the `mail` namespace. The
 * form translates a message only when it is one of these: a recipient field's
 * other messages are already sentences.
 */
export const COMPOSE_SIZE_MESSAGES = [
	"recipientsTooLong",
	"subjectTooLong",
	"bodyTooLong",
] as const;
export type ComposeSizeMessage = (typeof COMPOSE_SIZE_MESSAGES)[number];

/** Whether a field's message is one of the schema's keys. */
export function isComposeSizeMessage(
	message: string,
): message is ComposeSizeMessage {
	return (COMPOSE_SIZE_MESSAGES as readonly string[]).includes(message);
}

const upTo = (max: number, message: ComposeSizeMessage) =>
	z.string().check(z.maxLength(max, message));

/**
 * The composer's fields as text. It is `zod/mini` because the page ships it. The
 * recipient fields are read by `parseRecipients` on submit (that names the
 * pieces that are not addresses); here only the sizes are held. Each field
 * carries the same length as its `maxlength` attribute. The server is the gate
 * and parses the same limits again from the structured request.
 *
 * The schema is built from the limits the mail server publishes, so the
 * browser, the form and the route all hold the same numbers.
 */
export function composeFormSchema(limits: ComposeLimits) {
	return z.object({
		to: upTo(limits.maxRecipientsText, "recipientsTooLong"),
		cc: upTo(limits.maxRecipientsText, "recipientsTooLong"),
		bcc: upTo(limits.maxRecipientsText, "recipientsTooLong"),
		subject: upTo(limits.maxSubject, "subjectTooLong"),
		text: upTo(limits.maxText, "bodyTooLong"),
	});
}

export type ComposeFormValues = z.infer<ReturnType<typeof composeFormSchema>>;
