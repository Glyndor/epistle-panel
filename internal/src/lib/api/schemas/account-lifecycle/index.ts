import { z } from "zod";

/** `POST /api/v1/accounts`: the stored (lowercased) name of the new account. */
export const accountCreatedSchema = z.object({ created: z.string() });
export type AccountCreated = z.infer<typeof accountCreatedSchema>;

/** What the API does with the mail an account has queued when the account is deleted. */
export const QUEUE_CHOICES = ["drain", "discard"] as const;
export type QueueChoice = (typeof QUEUE_CHOICES)[number];

/**
 * `DELETE /api/v1/accounts/{name}`: what went with the account. Only the two
 * queue counters are read by the panel; the rest of the answer is counts of
 * the account's own data and is left unparsed.
 */
export const accountRemovedSchema = z.object({
	removed: z.string(),
	/** Queued messages dropped; non-zero only with `discard`. */
	queued_messages_discarded: z.number().int().nonnegative(),
	/** Queued messages left to be delivered; non-zero only with `drain`. */
	queued_messages_left: z.number().int().nonnegative(),
});
export type AccountRemoved = z.infer<typeof accountRemovedSchema>;
