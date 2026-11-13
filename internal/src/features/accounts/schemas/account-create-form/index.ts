import * as z from "zod/mini";

import { displayNameSchema } from "@/features/account-detail/schemas/display-name-form";
import { passwordSchema } from "@/features/account-detail/schemas/password-form";
import { ACCOUNT_NAME_PATTERN } from "@/lib/api/account-name-pattern";
import { isMailAddress } from "@/lib/mail-address-pattern";

/** Longest account name the mail server stores, in characters. */
export const ACCOUNT_NAME_MAX = 64;

/** Most addresses the form gives a new account; more are added later. */
export const ADDRESSES_MAX = 20;

/**
 * The account-name rule as an HTML `pattern`, for the browser's own check. The
 * same rule as `ACCOUNT_NAME_PATTERN`, written without anchors because the
 * attribute anchors itself. A browser compiles the attribute with the `v`
 * flag, under which a bare `-` at the end of a class is a syntax error: the
 * pattern is then ignored, with a console error, and the field checks nothing.
 * So the hyphen is escaped.
 */
export const ACCOUNT_NAME_HTML_PATTERN = "[a-z0-9][a-z0-9\\-]{0,63}";

/**
 * Read the addresses field: addresses separated by line breaks, commas,
 * semicolons or spaces. Empty pieces are dropped and a repeated address counts
 * once; nothing is repaired.
 */
export function splitAddresses(text: string): string[] {
	return [...new Set(text.split(/[\s,;]+/u).filter((piece) => piece !== ""))];
}

/**
 * The fields of the new-account form. `zod/mini`: the form ships it. The error
 * texts are message keys of the `accounts` namespace. The Server Action parses
 * the same rules again (`account-input`), and the mail server is the last gate:
 * only it knows whether the name is free, the addresses are in a hosted domain
 * and the password is in its list of leaked ones.
 */
export const createAccountFormSchema = z.object({
	name: z
		.string()
		.check(
			z.minLength(1, "nameRequired"),
			z.maxLength(ACCOUNT_NAME_MAX, "nameInvalid"),
			z.regex(ACCOUNT_NAME_PATTERN, "nameInvalid"),
		),
	displayName: displayNameSchema,
	addresses: z.string().check(
		z.refine(
			(value) => splitAddresses(value).length > 0,
			"addressesRequired",
		),
		z.refine(
			(value) => splitAddresses(value).length <= ADDRESSES_MAX,
			"addressesTooMany",
		),
		z.refine(
			(value) => splitAddresses(value).every(isMailAddress),
			"addressesInvalid",
		),
	),
	password: passwordSchema,
});
export type CreateAccountFormInput = z.input<typeof createAccountFormSchema>;

/** The message keys the form can show: the schemas', and the server's refusals. */
export const CREATE_ACCOUNT_ERROR_KEYS = [
	"nameRequired",
	"nameInvalid",
	"displayNameTooLong",
	"displayNameControl",
	"addressesRequired",
	"addressesTooMany",
	"addressesInvalid",
	"passwordTooShort",
	"passwordTooLong",
	"passwordCharset",
] as const;
