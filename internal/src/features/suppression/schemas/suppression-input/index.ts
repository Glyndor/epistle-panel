import { z } from "zod";

import { mailAddressSchema } from "@/lib/mail-address";

/**
 * Input of the suppression-page action. Strict: an unknown field is refused,
 * not ignored, so nothing the client adds reaches the API call. `after` is the
 * cursor the API issued as `next_cursor`, which is the last address of the
 * previous page.
 */
export const suppressionPageInputSchema = z.strictObject({
	after: mailAddressSchema.optional(),
});

/** Input of the remove-address action. */
export const removeAddressInputSchema = z.strictObject({
	address: mailAddressSchema,
});
