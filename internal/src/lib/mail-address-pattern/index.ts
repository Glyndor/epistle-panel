/**
 * The rule for an address the panel is willing to send to the API, as a
 * pattern and a test: one `@`, a non-empty local part and domain, no
 * whitespace, no control or format character (a line break, a NUL, a bidi
 * override), at most 254 characters. It lives in a file of its own with no
 * dependency, so a client component can test an address without bundling a
 * schema library. `lib/mail-address` builds its schema from here.
 */
export const MAIL_ADDRESS_PATTERN = /^[^\s@\p{C}]+@[^\s@\p{C}]+$/u;

/** Longest address the panel forwards: the SMTP forward-path limit (RFC 5321). */
export const MAX_ADDRESS_LENGTH = 254;

/** Whether `value` is a string that satisfies the address rule. */
export function isMailAddress(value: unknown): value is string {
	return (
		typeof value === "string" &&
		value.length <= MAX_ADDRESS_LENGTH &&
		MAIL_ADDRESS_PATTERN.test(value)
	);
}
