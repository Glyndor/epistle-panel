/**
 * Default minimum duration of a sign-in attempt, in milliseconds, whatever its
 * outcome. The API verifies a password with a slow hash for an existing
 * account and answers at once for an unknown one; holding every outcome to the
 * same floor hides that difference. The floor only hides it while the API
 * answers within the floor: the real API's hash time was not measured when this
 * was written, so the value is a guess, and an operator whose API is slower
 * raises it with `EPISTLE_PANEL_LOGIN_MIN_MS`. An answer slower than the floor
 * shows through, and the API has no timeout of its own yet.
 */
export const LOGIN_RESPONSE_FLOOR_MS = 1000;

/** Largest floor accepted from the environment, in milliseconds. */
export const MAX_LOGIN_RESPONSE_FLOOR_MS = 30_000;

/**
 * The floor in force: `EPISTLE_PANEL_LOGIN_MIN_MS` when it is a whole number
 * of milliseconds from 0 up to {@link MAX_LOGIN_RESPONSE_FLOOR_MS}, otherwise
 * {@link LOGIN_RESPONSE_FLOOR_MS}. A value that does not parse never lowers the
 * floor.
 */
export function loginResponseFloorMs(): number {
	const raw = process.env.EPISTLE_PANEL_LOGIN_MIN_MS?.trim();
	if (raw === undefined || !/^\d{1,5}$/.test(raw)) {
		return LOGIN_RESPONSE_FLOOR_MS;
	}
	const value = Number(raw);
	return value <= MAX_LOGIN_RESPONSE_FLOOR_MS
		? value
		: LOGIN_RESPONSE_FLOOR_MS;
}

/**
 * Wait until `floorMs` have passed since `startedAt` (a `Date.now()` value).
 * Returns at once when that time is already gone.
 */
export async function holdUntilFloor(
	startedAt: number,
	floorMs: number = loginResponseFloorMs(),
): Promise<void> {
	const remaining = floorMs - (Date.now() - startedAt);
	if (remaining > 0) {
		await new Promise<void>((resolve) => setTimeout(resolve, remaining));
	}
}
