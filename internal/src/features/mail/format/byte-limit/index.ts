/** A size in bytes as a number and its unit, for the reader's number format to write. */
export interface ByteLimit {
	readonly value: number;
	readonly unit: "KiB" | "MiB" | "GiB" | "TiB";
}

/**
 * Binary units, smallest first: the limit the mail server publishes is a
 * number of bytes that the operator sets in mebibytes, and the panel says so
 * in the same unit.
 */
const UNITS = [
	["KiB", 1024],
	["MiB", 1024 * 1024],
	["GiB", 1024 * 1024 * 1024],
] as const;

const TEBIBYTE = 1024 * 1024 * 1024 * 1024;

const oneDecimal = (value: number) => Math.round(value * 10) / 10;

/**
 * A number of bytes in the unit that writes it with fewer than a thousand of
 * them: whole kibibytes, and one decimal from a mebibyte up. The unit is
 * chosen after rounding, so a size just under a unit reads as one of it
 * ("1 MiB"), never as a thousand of the unit below. Nothing, a negative number
 * and anything that is not a number read as zero kibibytes; a few bytes read
 * as one. Past the largest unit the number simply grows.
 */
export function byteLimit(bytes: number): ByteLimit {
	const size = Number.isFinite(bytes) ? Math.max(0, bytes) : 0;
	if (size === 0) {
		return { value: 0, unit: "KiB" };
	}
	for (const [unit, factor] of UNITS) {
		const value =
			unit === "KiB"
				? Math.max(1, Math.round(size / factor))
				: oneDecimal(size / factor);
		if (value < 1024) {
			return { value, unit };
		}
	}
	return { value: oneDecimal(size / TEBIBYTE), unit: "TiB" };
}
