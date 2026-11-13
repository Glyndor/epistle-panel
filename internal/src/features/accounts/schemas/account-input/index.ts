import { z } from "zod";

import { displayNameSchema } from "@/features/account-detail/schemas/display-name-form";
import { passwordSchema } from "@/features/account-detail/schemas/password-form";
import { ADDRESSES_MAX } from "@/features/accounts/schemas/account-create-form";
import { accountNameSchema, QUEUE_CHOICES } from "@/lib/api/schemas";
import { mailAddressSchema } from "@/lib/mail-address";

/**
 * The inputs of the account create and delete Server Actions. Both are strict,
 * so a field the client adds is refused and never reaches the API call. The
 * rules are the form's own, parsed again here: the browser runs them as
 * fail-fast help, this is the gate, and the mail server decides the rest.
 */
export const createAccountInputSchema = z.strictObject({
	name: accountNameSchema,
	displayName: displayNameSchema,
	addresses: z
		.array(mailAddressSchema)
		.min(1)
		.max(ADDRESSES_MAX)
		.refine((list) => new Set(list).size === list.length),
	password: passwordSchema,
});

export const deleteAccountInputSchema = z.strictObject({
	name: accountNameSchema,
	queue: z.enum(QUEUE_CHOICES),
});
