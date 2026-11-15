import "server-only";

import { cookies } from "next/headers";

import {
	effectiveRefreshPace,
	parseRefreshPace,
	REFRESH_COOKIE,
	type RefreshPace,
} from "@/features/refresh/config/pace";
import { readOperatorRefreshPace } from "@/lib/config/refresh";
import { sessionPolicy } from "@/lib/config/session-policy";

/**
 * The pace this request chose, from the `refresh` cookie. The cookie comes from
 * the browser, so anything that is not exactly one of the list reads as
 * `normal`.
 */
export async function readRefreshPacePreference(): Promise<RefreshPace> {
	return parseRefreshPace((await cookies()).get(REFRESH_COOKIE)?.value);
}

/**
 * The pace that was chosen for this request: the operator's when they fixed
 * one, and the person's otherwise. It is what the preferences page shows.
 */
export async function readChosenRefreshPace(): Promise<RefreshPace> {
	const operatorPace = readOperatorRefreshPace();
	if (operatorPace !== null) {
		return operatorPace;
	}
	return readRefreshPacePreference();
}

/**
 * The pace every refreshing list of this request really runs at: the chosen
 * one, except that `slow` runs as `normal` when the session's idle timeout is
 * too short for it (`effectiveRefreshPace`), so an open page keeps the session
 * alive whatever was chosen. The layouts and the preferences page both read it
 * here.
 */
export async function readEffectiveRefreshPace(): Promise<RefreshPace> {
	return effectiveRefreshPace(
		await readChosenRefreshPace(),
		sessionPolicy()?.idleTimeoutSeconds,
	);
}

/** Whether what was chosen is not what runs, so the page can say so. */
export async function isRefreshPaceDegraded(): Promise<boolean> {
	return (
		(await readChosenRefreshPace()) !== (await readEffectiveRefreshPace())
	);
}
