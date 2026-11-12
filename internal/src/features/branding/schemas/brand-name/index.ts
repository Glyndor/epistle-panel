import { z } from "zod";

/** Name shown when the operator sets none. */
export const DEFAULT_BRAND_NAME = "Epistle";

/**
 * The product name an operator may set: 1 to 40 characters once trimmed, no
 * control characters (a newline in a title or a menu would be a defect, not a
 * name). React escapes it wherever it is rendered.
 */
export const brandNameSchema = z
	.string()
	.trim()
	.min(1)
	.max(40)
	// biome-ignore lint/suspicious/noControlCharactersInRegex: rejecting control characters is the point
	.regex(/^[^\u0000-\u001f\u007f]+$/);
