import "server-only";

import {
	isRefreshPace,
	type RefreshPace,
} from "@/features/refresh/config/pace";

import { ConfigError } from "../config-error";

export const REFRESH_VARIABLE = "EPISTLE_PANEL_REFRESH";

/**
 * The refresh pace the operator fixed for everyone, or `null` when they fixed
 * none. A value that is not one of the list stops the server: a panel that kept
 * running would poll at a pace nobody chose. The error names the variable and
 * never its value.
 */
export function readOperatorRefreshPace(): RefreshPace | null {
	const value = (process.env[REFRESH_VARIABLE] ?? "").trim();
	if (value === "") {
		return null;
	}
	if (!isRefreshPace(value)) {
		throw new ConfigError(
			`${REFRESH_VARIABLE} is set to a pace the panel does not support`,
		);
	}
	return value;
}
