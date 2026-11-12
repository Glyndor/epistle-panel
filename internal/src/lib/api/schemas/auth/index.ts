import { z } from "zod";

/** `POST /api/v1/auth/verify` */
export const verifyResultSchema = z.object({
	valid: z.boolean(),
	admin: z.boolean(),
});
export type VerifyResult = z.infer<typeof verifyResultSchema>;
