import { z } from "zod";

/** `GET /api/v1/accounts/{name}/archive` */
export const archiveListSchema = z.object({
	entries: z.array(
		z.object({
			id: z.uuid(),
			mailbox: z.string(),
			deleted_at: z.number().int().nonnegative(),
		}),
	),
});
export type ArchiveList = z.infer<typeof archiveListSchema>;

/** `POST /api/v1/accounts/{name}/archive/{id}/restore` */
export const restoredSchema = z.object({
	id: z.uuid(),
	restored_to: z.string(),
});
export type Restored = z.infer<typeof restoredSchema>;
