import { z } from "zod";

/** A queue cursor, the id the API issues as `next_cursor`. */
export const queueCursorSchema = z.uuid();

/** An outbound queue entry id. Branded so a plain string cannot be passed by accident. */
export const queueEntryIdSchema = z.uuid().brand<"QueueEntryId">();
export type QueueEntryId = z.infer<typeof queueEntryIdSchema>;

/**
 * Input of the queue-page action. Strict: an unknown field is refused, not
 * ignored, so nothing the client adds reaches the API call. Used by the client
 * to build the request and by the action, which is the real gate.
 */
export const queuePageInputSchema = z.strictObject({
	cursor: queueCursorSchema.optional(),
});

/** Input of the remove-entry action. */
export const removeEntryInputSchema = z.strictObject({
	id: queueEntryIdSchema,
});

/**
 * Read the `cursor` query parameter of the queue page. Next hands a repeated
 * parameter over as an array, so only the first value is used. A value that is
 * not a UUID is dropped and the page starts from the beginning instead of
 * forwarding arbitrary text to the API.
 */
export function parseCursorParam(
	value: string | string[] | undefined,
): string | undefined {
	const first = Array.isArray(value) ? value[0] : value;
	const parsed = queueCursorSchema.safeParse(first);
	return parsed.success ? parsed.data : undefined;
}
