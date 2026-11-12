import { z } from "zod";

/** `GET /api/v1/suppression` */
export const suppressionPageSchema = z.object({
	addresses: z.array(z.string()),
	next_cursor: z.string().optional(),
});
export type SuppressionPage = z.infer<typeof suppressionPageSchema>;

/** `DELETE /api/v1/suppression/{address}` */
export const removedAddressSchema = z.object({
	removed: z.string(),
});
export type RemovedAddress = z.infer<typeof removedAddressSchema>;
