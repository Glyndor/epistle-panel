import "server-only";

import { cookies } from "next/headers";

import {
	parseRefreshPace,
	REFRESH_COOKIE,
	type RefreshPace,
} from "@/features/refresh/config/pace";
import { readOperatorRefreshPace } from "@/lib/config/refresh";

/**
 * The pace this request chose, from the `refresh` cookie. The cookie comes from
 * the browser, so anything that is not exactly one of the list reads as
 * `normal`.
 */
export async function readRefreshPacePreference(): Promise<RefreshPace> {
	return parseRefreshPace((await cookies()).get(REFRESH_COOKIE)?.value);
}

/**
 * The pace every refreshing list of this request uses: the operator's when
 * they fixed one, and the person's otherwise.
 */
export async function readEffectiveRefreshPace(): Promise<RefreshPace> {
	const operatorPace = readOperatorRefreshPace();
	if (operatorPace !== null) {
		return operatorPace;
	}
	return readRefreshPacePreference();
}
