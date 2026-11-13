import { z } from "zod";

/**
 * A masked address as the server mints it: a slug of the label (lowercase
 * letters and digits, single hyphens), a dot, eight lowercase base32 characters,
 * and the domain of the account's first address. It goes into an API path, so
 * only this shape is accepted there; the listing itself is read loosely, so a
 * row the server wrote differently still shows.
 */
export const maskedAddressSchema = z
	.string()
	.max(254)
	.regex(
		/^[a-z0-9]+(?:-[a-z0-9]+)*\.[a-z2-7]{8}@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/,
	)
	.brand<"MaskedAddress">();
export type MaskedAddress = z.infer<typeof maskedAddressSchema>;

/** `GET /api/v1/accounts/{name}/masked` */
export const maskedListSchema = z.object({
	addresses: z.array(
		z.object({
			address: z.string(),
			label: z.string(),
			enabled: z.boolean(),
			created_at: z.number().int().nonnegative(),
			last_used_at: z.number().int().nonnegative().optional(),
		}),
	),
});
export type MaskedList = z.infer<typeof maskedListSchema>;

/** `POST /api/v1/accounts/{name}/masked` */
export const maskedCreatedSchema = z.object({ address: z.string() });
export type MaskedCreated = z.infer<typeof maskedCreatedSchema>;

/** `DELETE /api/v1/accounts/{name}/masked/{address}` */
export const maskedRemovedSchema = z.object({ removed: z.string() });
export type MaskedRemoved = z.infer<typeof maskedRemovedSchema>;
