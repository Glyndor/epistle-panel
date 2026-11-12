import { z } from "zod";

import { ACCOUNT_NAME_PATTERN } from "../../account-name-pattern";

/** Longest account name the mail server stores, in characters. */
export const ACCOUNT_NAME_MAX = 64;

/**
 * An account name as the mail server stores it: lowercase ASCII letters, digits
 * and hyphens, not starting with a hyphen, at most 64 characters. It is also the
 * folder name of the account, so the rule is a hard one. Branded so a plain
 * string cannot reach an API path by accident. The pattern has no way to
 * express `.`, `..`, `/`, `%`, a newline or a non-ASCII letter, which is what
 * keeps a name taken from a URL from becoming a different path.
 */
export const accountNameSchema = z
	.string()
	.regex(ACCOUNT_NAME_PATTERN)
	.brand<"AccountName">();
export type AccountName = z.infer<typeof accountNameSchema>;

/**
 * The route parameter of an account page. Next hands over the decoded value (a
 * `%2f` arrives as `/`), and a repeated or missing parameter is not a name.
 */
export function parseAccountNameParam(
	value: string | string[] | undefined,
): AccountName | undefined {
	const parsed = accountNameSchema.safeParse(value);
	return parsed.success ? parsed.data : undefined;
}
