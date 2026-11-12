import { z } from "zod";

/** Longest address the panel forwards: the SMTP forward-path limit (RFC 5321). */
export const MAX_ADDRESS_LENGTH = 254;

/**
 * An address the panel is willing to send to the API as a value: one `@`, a
 * non-empty local part and domain, no whitespace, no control or format
 * character (a line break, a NUL, a bidi override), at most 254 characters.
 * Characters outside ASCII are allowed, since the lists hold what the mail
 * server stored. It is not a deliverability check: the API is the real gate,
 * this keeps text that is not an address from reaching it. A value that goes
 * into a URL path is still passed through `encodeURIComponent`.
 */
export const mailAddressSchema = z
	.string()
	.max(MAX_ADDRESS_LENGTH)
	.regex(/^[^\s@\p{C}]+@[^\s@\p{C}]+$/u);

/**
 * Read an address from a page's query parameter. Next hands a repeated
 * parameter over as an array, so only the first value counts. A value that is
 * not an address is dropped.
 */
export function parseAddressParam(
	value: string | string[] | undefined,
): string | undefined {
	const first = Array.isArray(value) ? value[0] : value;
	const parsed = mailAddressSchema.safeParse(first);
	return parsed.success ? parsed.data : undefined;
}
