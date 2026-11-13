/**
 * The `maxlength` of a field whose schema takes `limit` characters: one more.
 *
 * A browser cuts a paste at `maxlength` without a word, and what is left is
 * sent as if it were whole: a password nobody typed, a list of recipients that
 * ends in half an address which still reads as one. With one character of room
 * a cut value is one over the schema's limit, so the form names it and sends
 * nothing. The field is still bounded in the page.
 */
export function fieldLength(limit: number): number {
	return limit + 1;
}
