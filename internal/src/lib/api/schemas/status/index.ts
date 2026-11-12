import { z } from "zod";

/** `GET /api/v1/status` */
export const statusSchema = z.object({
	version: z.string(),
	domains: z.number().int().nonnegative(),
	accounts: z.number().int().nonnegative(),
	queue_size: z.number().int().nonnegative(),
});
export type Status = z.infer<typeof statusSchema>;
