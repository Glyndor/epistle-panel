import { z } from "zod";

/** Error shape shared by every endpoint. */
export const apiErrorSchema = z.object({
	error: z.object({
		code: z.string(),
		message: z.string(),
	}),
});
export type ApiErrorBody = z.infer<typeof apiErrorSchema>;
