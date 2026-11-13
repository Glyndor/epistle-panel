import { z } from "zod";

import { displayNameSchema } from "@/features/account-detail/schemas/display-name-form";
import { maskedLabelSchema } from "@/features/account-detail/schemas/masked-label-form";
import { passwordSchema } from "@/features/account-detail/schemas/password-form";
import { accountNameSchema, maskedAddressSchema } from "@/lib/api/schemas";

/**
 * The inputs of the account Server Actions. Every one is strict, so a field the
 * client adds is refused and never reaches the API call, and every one starts
 * with the account name, which has to be a real account name before it can
 * become part of an API path. The form schemas are reused as they are: the
 * browser runs them as fail-fast help, the action is the gate.
 */
export const accountInputSchema = z.strictObject({ name: accountNameSchema });

export const passwordInputSchema = z.strictObject({
	name: accountNameSchema,
	password: passwordSchema,
});

export const displayNameInputSchema = z.strictObject({
	name: accountNameSchema,
	displayName: displayNameSchema,
});

export const createMaskedInputSchema = z.strictObject({
	name: accountNameSchema,
	label: maskedLabelSchema,
});

export const removeMaskedInputSchema = z.strictObject({
	name: accountNameSchema,
	address: maskedAddressSchema,
});

export const restoreArchivedInputSchema = z.strictObject({
	name: accountNameSchema,
	id: z.uuid(),
});
