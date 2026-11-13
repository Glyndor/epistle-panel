import * as z from "zod/mini";

/** Longest display name the mail server stores, in characters. */
export const DISPLAY_NAME_MAX = 128;

/**
 * The `maxlength` of a display-name input. The server counts code points and
 * the attribute counts UTF-16 units, where a character outside the basic plane
 * is two: the input allows twice the limit, so no name the server takes is cut,
 * and the schema does the exact count.
 */
export const DISPLAY_NAME_HTML_MAX = DISPLAY_NAME_MAX * 2;

/**
 * The no-control-character rule as an input's `pattern` attribute, which a
 * browser anchors and compiles with the `v` flag.
 */
export const DISPLAY_NAME_HTML_PATTERN = "[^\\p{Cc}]*";

/**
 * The person's name of an account: trimmed, at most 128 characters (counted as
 * the server counts them, by code point), no control character, so it cannot
 * break out of the `From` header it ends up in. Empty is allowed and clears it.
 */
export const displayNameSchema = z.string().check(
	z.trim(),
	z.refine(
		(value) => [...value].length <= DISPLAY_NAME_MAX,
		"displayNameTooLong",
	),
	z.refine((value) => !/\p{Cc}/u.test(value), "displayNameControl"),
);

/** The display-name form's fields. */
export const displayNameFormSchema = z.object({
	displayName: displayNameSchema,
});
export type DisplayNameFormInput = z.input<typeof displayNameFormSchema>;

/** The message keys the form can show: the schema's, and the server's refusal. */
export const DISPLAY_NAME_ERROR_KEYS = [
	"displayNameTooLong",
	"displayNameControl",
	"displayNameRefused",
] as const;
