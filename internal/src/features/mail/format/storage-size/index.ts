/** A size as a number and its unit, for the reader's number format to write. */
export interface StorageSize {
	readonly value: number;
	readonly unit: "KB" | "MB" | "GB" | "TB";
}

/** Decimal units, like the attachment sizes of the reader, smallest first; past them all the unit is the terabyte. */
const UNITS = [
	["KB", 1_000],
	["MB", 1_000_000],
	["GB", 1_000_000_000],
] as const;
const TERABYTE = 1_000_000_000_000;

const oneDecimal = (value: number) => Math.round(value * 10) / 10;

/**
 * A number of bytes in the unit that writes it with fewer than a thousand of
 * them: whole kilobytes, and one decimal from a megabyte up. The unit is
 * chosen after rounding, so a size just under a unit reads as one of it
 * ("1 MB"), never as a thousand of the unit below. Nothing, a negative number
 * and anything that is not a number read as zero kilobytes; a few bytes read
 * as one. Past the largest unit the number simply grows.
 */
export function storageSize(bytes: number): StorageSize {
	const size = Number.isFinite(bytes) ? Math.max(0, bytes) : 0;
	if (size === 0) {
		return { value: 0, unit: "KB" };
	}
	for (const [unit, factor] of UNITS) {
		const value =
			unit === "KB"
				? Math.max(1, Math.round(size / factor))
				: oneDecimal(size / factor);
		if (value < 1000) {
			return { value, unit };
		}
	}
	return { value: oneDecimal(size / TERABYTE), unit: "TB" };
}
