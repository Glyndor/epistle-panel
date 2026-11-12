import { z } from "zod";

/** `GET /api/v1/accounts` */
export const accountsSchema = z.object({
	accounts: z.array(
		z.object({
			name: z.string(),
			addresses: z.array(z.string()),
		}),
	),
});
export type Accounts = z.infer<typeof accountsSchema>;
