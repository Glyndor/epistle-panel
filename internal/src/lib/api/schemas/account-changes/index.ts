import { z } from "zod";

/** `PUT /api/v1/accounts/{name}/password` and `DELETE /api/v1/accounts/{name}/totp` */
export const updatedSchema = z.object({ updated: z.string() });
export type Updated = z.infer<typeof updatedSchema>;

/** `PUT /api/v1/accounts/{name}/display_name`: the stored name, `null` once cleared. */
export const displayNameSchema = z.object({
	display_name: z.string().nullable(),
});
export type DisplayNameStored = z.infer<typeof displayNameSchema>;

/** `POST /api/v1/accounts/{name}/totp`: the one place the secret is ever returned. */
export const totpEnrolledSchema = z.object({
	secret: z.string(),
	otpauth_uri: z.string(),
});
export type TotpEnrolled = z.infer<typeof totpEnrolledSchema>;
