/**
 * What the API does with the mail an account has queued when the account is
 * deleted. It is in a file of its own with no dependency, so the dialog that
 * offers the choice does not bring the schema library into the browser with
 * it. `lib/api/schemas` hands the same values on to the server's code.
 */
export const QUEUE_CHOICES = ["drain", "discard"] as const;
export type QueueChoice = (typeof QUEUE_CHOICES)[number];
