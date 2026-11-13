import * as z from "zod/mini";

/** Longest label accepted, in characters. */
export const MASKED_LABEL_MAX = 64;

/**
 * The label a masked address is minted from. The server keeps the letters and
 * digits as the start of the address, so one of them is required; control
 * characters are refused, and the length is the panel's own bound.
 */
export const maskedLabelSchema = z.string().check(
	z.trim(),
	z.minLength(1, "labelRequired"),
	z.maxLength(MASKED_LABEL_MAX, "labelTooLong"),
	z.regex(/[A-Za-z0-9]/, "labelNeedsLetter"),
	z.refine((value) => !/\p{Cc}/u.test(value), "labelControl"),
);

/** The create-masked-address form's fields. */
export const maskedLabelFormSchema = z.object({ label: maskedLabelSchema });
export type MaskedLabelFormInput = z.input<typeof maskedLabelFormSchema>;

/** The message keys the form can show: the schema's, and the server's refusals. */
export const MASKED_LABEL_ERROR_KEYS = [
	"labelRequired",
	"labelTooLong",
	"labelNeedsLetter",
	"labelControl",
	"maskedRefused",
	"maskedLimit",
] as const;
