import { z } from "zod";

/** `GET /api/v1/accounts/{name}/mailboxes` */
export const mailboxesSchema = z.object({
	mailboxes: z.array(z.string()),
	tree: z.array(
		z.object({
			id: z.string(),
			name: z.string(),
			parent_id: z.string().nullable(),
		}),
	),
});
export type Mailboxes = z.infer<typeof mailboxesSchema>;
