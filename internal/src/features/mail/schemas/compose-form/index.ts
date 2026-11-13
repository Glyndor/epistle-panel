import * as z from "zod/mini";

import { MAX_COMPOSE_TEXT } from "@/features/mail/schemas/compose-input-limits";

/**
 * The composer's fields as text. It is `zod/mini` because the page ships it. The
 * recipient fields are read by `parseRecipients` on submit (that names the
 * pieces that are not addresses); here only the sizes are held, as message keys
 * of the `mail` namespace. The server is the gate and parses the same limits
 * again from the structured request.
 */
export const composeFormSchema = z.object({
	to: z.string().check(z.maxLength(20_000, "recipientsTooLong")),
	cc: z.string().check(z.maxLength(20_000, "recipientsTooLong")),
	bcc: z.string().check(z.maxLength(20_000, "recipientsTooLong")),
	subject: z.string().check(z.maxLength(998, "subjectTooLong")),
	text: z.string().check(z.maxLength(MAX_COMPOSE_TEXT, "bodyTooLong")),
});
export type ComposeFormValues = z.infer<typeof composeFormSchema>;
