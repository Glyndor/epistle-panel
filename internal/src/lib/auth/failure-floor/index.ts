/**
 * Minimum duration of a failed login, in milliseconds. The API verifies a
 * password with a slow hash for an existing account and fails fast for an
 * unknown one; holding every failure to the same floor hides that difference.
 * The floor sits above the hash time, so a failure that is slower than it still
 * shows through (the API has no timeout of its own yet).
 */
export const LOGIN_FAILURE_FLOOR_MS = 1000;

/**
 * Wait until `floorMs` have passed since `startedAt` (a `Date.now()` value).
 * Returns at once when that time is already gone.
 */
export async function holdUntilFloor(
	startedAt: number,
	floorMs: number = LOGIN_FAILURE_FLOOR_MS,
): Promise<void> {
	const remaining = floorMs - (Date.now() - startedAt);
	if (remaining > 0) {
		await new Promise<void>((resolve) => setTimeout(resolve, remaining));
	}
}
