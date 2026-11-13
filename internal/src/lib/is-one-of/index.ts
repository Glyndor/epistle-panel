/**
 * Whether `value` is one of the strings in `list`, narrowing it to their union.
 * A form schema fails with a message key; this is how the component proves the
 * key is one of the catalog's before it asks the translator for it.
 */
export function isOneOf<const T extends readonly string[]>(
	list: T,
	value: string,
): value is T[number] {
	return (list as readonly string[]).includes(value);
}
