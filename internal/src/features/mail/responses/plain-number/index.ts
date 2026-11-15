/**
 * A number written as plain decimal digits, and nothing else. Fifteen digits
 * is the most a number can have and stay an exact integer in JavaScript, so a
 * longer one is refused rather than rounded.
 */
const PLAIN_DECIMAL = /^[0-9]{1,15}$/;

/**
 * The number a plain decimal string says, or `null` when it says none: the
 * value is missing, empty, or written in any other form.
 */
export function plainNumber(value: string | null): number | null {
	if (value === null || !PLAIN_DECIMAL.test(value)) {
		return null;
	}
	return Number(value);
}

/**
 * The length a request declares, when it declares one at all. Only digits
 * count: `Number()` would also read `1e3`, `0x64` and ` 100 `, which are not
 * lengths, and a header that is not one is refused as a missing one is.
 */
export function declaredLength(header: string | null): number | null {
	const length = plainNumber(header);
	return length !== null && length > 0 ? length : null;
}
