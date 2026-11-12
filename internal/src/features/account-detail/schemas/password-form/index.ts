import * as z from "zod/mini";

/** Shortest and longest password the global policy accepts, in characters. */
export const PASSWORD_MIN = 12;
export const PASSWORD_MAX = 64;

/**
 * A new password under the global policy: 12 to 64 printable ASCII characters,
 * no composition rules. The breached-password check is the server's, which has
 * the list; a refusal on that ground comes back as `rejected`. The error texts
 * are message keys of the `accountDetail` namespace. `zod/mini`: the form ships
 * it, and the Server Action parses the same schema as the real gate.
 */
export const passwordSchema = z
	.string()
	.check(
		z.minLength(PASSWORD_MIN, "passwordTooShort"),
		z.maxLength(PASSWORD_MAX, "passwordTooLong"),
		z.regex(/^[\x20-\x7e]*$/, "passwordCharset"),
	);

/** The change-password form's fields. */
export const passwordFormSchema = z.object({ password: passwordSchema });
export type PasswordFormInput = z.input<typeof passwordFormSchema>;

/** The message keys the form can show: the schema's, and the server's refusal. */
export const PASSWORD_ERROR_KEYS = [
	"passwordTooShort",
	"passwordTooLong",
	"passwordCharset",
	"passwordRefused",
] as const;
