import { z } from "zod";

const cursorSchema = z.uuid();

/**
 * Read the `cursor` query parameter of the queue page. Next hands a repeated
 * parameter over as an array, so only the first value is used. A value that is
 * not a UUID, the shape the API issues in `next_cursor`, is dropped and the page
 * starts from the beginning instead of forwarding arbitrary text to the API.
 */
export function parseCursor(
	value: string | string[] | undefined,
): string | undefined {
	const first = Array.isArray(value) ? value[0] : value;
	const parsed = cursorSchema.safeParse(first);
	return parsed.success ? parsed.data : undefined;
}
