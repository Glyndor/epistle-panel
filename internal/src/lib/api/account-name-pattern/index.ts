/**
 * The rule for an account name, as a pattern: lowercase ASCII letters, digits
 * and hyphens, not starting with a hyphen, at most 64 characters. It lives in
 * a file of its own with no dependency, so a client component can test a name
 * without bundling a schema library. The schema, the route parameter and the
 * API client all take their rule from here.
 */
export const ACCOUNT_NAME_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;

/** Whether `value` is a string that satisfies {@link ACCOUNT_NAME_PATTERN}. */
export function isAccountName(value: unknown): value is string {
	return typeof value === "string" && ACCOUNT_NAME_PATTERN.test(value);
}
