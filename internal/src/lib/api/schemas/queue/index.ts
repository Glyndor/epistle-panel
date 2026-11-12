import { z } from "zod";

/** `GET /api/v1/queue` */
export const queuePageSchema = z.object({
	entries: z.array(
		z.object({
			id: z.uuid(),
			reverse_path: z.string(),
			recipients: z.array(z.string()),
		}),
	),
	next_cursor: z.uuid().optional(),
});
export type QueuePage = z.infer<typeof queuePageSchema>;

/** `DELETE /api/v1/queue/{id}` */
export const removedSchema = z.object({
	removed: z.uuid(),
});
export type Removed = z.infer<typeof removedSchema>;
