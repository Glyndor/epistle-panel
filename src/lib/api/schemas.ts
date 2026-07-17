import { z } from "zod";

/** `GET /api/v1/status` */
export const statusSchema = z.object({
	version: z.string(),
	domains: z.number().int().nonnegative(),
	accounts: z.number().int().nonnegative(),
	queue_size: z.number().int().nonnegative(),
});
export type Status = z.infer<typeof statusSchema>;

/** `GET /api/v1/domains` */
export const domainsSchema = z.object({
	domains: z.array(z.string()),
});
export type Domains = z.infer<typeof domainsSchema>;

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

/** `POST /api/v1/auth/verify` */
export const verifyResultSchema = z.object({
	valid: z.boolean(),
	admin: z.boolean(),
});
export type VerifyResult = z.infer<typeof verifyResultSchema>;

/** Error shape shared by every endpoint. */
export const apiErrorSchema = z.object({
	error: z.object({
		code: z.string(),
		message: z.string(),
	}),
});
export type ApiErrorBody = z.infer<typeof apiErrorSchema>;
