import "server-only";

import { isAdminIdShape } from "@/lib/routes";

import { ConfigError } from "../config-error";
import { readSecret } from "../secret";

/** Name of the variable that holds the admin id, or `<name>_FILE` the file that does. */
export const ADMIN_ID_VARIABLE = "EPISTLE_PANEL_ADMIN_ID";

/** Whether the admin area is on, and with which id. */
export type AdminIdState =
	| { state: "enabled"; id: string }
	| { state: "disabled" };

/**
 * Read the admin id of this installation. Not set means the admin area is off,
 * which is the fail-closed default. Set to something that is not a lower-case
 * UUID v4 throws a {@link ConfigError} that names the variable and never the
 * value: a malformed id must not turn into "any id will do" or into silence.
 * The id is not a cryptographic secret, but it is read like one so a mounted
 * file works the same way as for the others.
 */
export async function readAdminIdState(): Promise<AdminIdState> {
	const value = await readSecret(ADMIN_ID_VARIABLE);
	if (value === undefined) {
		return { state: "disabled" };
	}
	if (!isAdminIdShape(value)) {
		throw new ConfigError(
			`${ADMIN_ID_VARIABLE} is set but is not a lower-case UUID v4`,
		);
	}
	return { state: "enabled", id: value };
}

/**
 * The configured admin id, or `undefined` when the admin area is off. Every
 * failure to read it counts as off, so a request path never depends on a
 * broken setting; the start-up check is what reports the problem.
 */
export async function readAdminId(): Promise<string | undefined> {
	try {
		const state = await readAdminIdState();
		return state.state === "enabled" ? state.id : undefined;
	} catch {
		return undefined;
	}
}
