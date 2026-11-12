import { z } from "zod";

/** `GET /api/v1/accounts` */
export const accountsSchema = z.object({
	accounts: z.array(
		z.object({
			name: z.string(),
			/** The person's name, `null` when unset. */
			display_name: z.string().nullable(),
			addresses: z.array(z.string()),
			/** True for an account made through the API; false for one in the configuration file. */
			dynamic: z.boolean(),
		}),
	),
});
export type Accounts = z.infer<typeof accountsSchema>;
