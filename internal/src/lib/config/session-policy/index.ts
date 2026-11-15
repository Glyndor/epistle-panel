import "server-only";

import { ConfigError } from "../config-error";

/**
 * Absolute lifetime of a user's session, in minutes. Unset or empty leaves the
 * panel's own default of eight hours.
 */
export const SESSION_USER_MAX_AGE_VARIABLE =
	"EPISTLE_PANEL_SESSION_USER_MAX_AGE_MINUTES";

/**
 * Absolute lifetime of an admin's session, in minutes. Unset or empty leaves
 * the panel's own default of eight hours.
 */
export const SESSION_ADMIN_MAX_AGE_VARIABLE =
	"EPISTLE_PANEL_SESSION_ADMIN_MAX_AGE_MINUTES";

/**
 * Idle timeout in minutes: a session nobody used for that long is refused and
 * the person goes to sign in. Unset or empty leaves it off.
 */
export const SESSION_IDLE_TIMEOUT_VARIABLE =
	"EPISTLE_PANEL_SESSION_IDLE_TIMEOUT_MINUTES";

/** Lifetime both roles have when the operator sets nothing: eight hours. */
export const DEFAULT_SESSION_MAX_AGE_MINUTES = 8 * 60;

/** Shortest lifetime accepted, in minutes. */
export const MIN_SESSION_MINUTES = 1;

/** Longest lifetime accepted, in minutes: thirty days. */
export const MAX_SESSION_MINUTES = 30 * 24 * 60;

/** What the operator decided about sessions. */
export interface SessionPolicy {
	/** Absolute lifetime of a user's session, in seconds. */
	userMaxAgeSeconds: number;
	/** Absolute lifetime of an admin's session, in seconds. */
	adminMaxAgeSeconds: number;
	/** Idle timeout in seconds, or `undefined` when the operator leaves it off. */
	idleTimeoutSeconds: number | undefined;
}

/**
 * Read a lifetime in minutes.
 *
 * A value that is not a whole number of minutes, or one outside the accepted
 * range, is a mistake the operator must hear about: the start refuses to go on
 * with it. The error names the variable and never the value, so a log line
 * cannot carry a setting that was not meant to be public.
 */
function parseMinutes(variable: string, raw: string): number {
	const text = raw.trim();
	if (!/^\d+$/.test(text)) {
		throw new ConfigError(
			`${variable} is set but is not a whole number of minutes`,
		);
	}
	const minutes = Number.parseInt(text, 10);
	if (minutes < MIN_SESSION_MINUTES || minutes > MAX_SESSION_MINUTES) {
		throw new ConfigError(
			`${variable} is set but is outside the accepted range of ${MIN_SESSION_MINUTES} to ${MAX_SESSION_MINUTES} minutes`,
		);
	}
	return minutes;
}

/** Whether the variable carries nothing, which reads as unset. */
function isUnset(raw: string | undefined): boolean {
	return raw === undefined || raw.trim() === "";
}

/** The policy that was read last, so a request does not re-read the environment. */
let memo: { raw: (string | undefined)[]; policy: SessionPolicy } | undefined;

/**
 * The session policy in force, read from the three session variables of the
 * panel: the lifetime of a user session, the lifetime of an admin session and
 * the idle timeout.
 *
 * The absolute lifetime is per role: an operator may keep a user session short
 * and an admin session long, or the other way round. The idle timeout is
 * optional and off unless it is set; when it is on, a session nobody used for
 * that long is refused.
 *
 * Throws a `ConfigError` naming the variable when a value cannot be used. The
 * value itself is never in the message.
 */
export function readSessionPolicy(): SessionPolicy {
	const userRaw = process.env[SESSION_USER_MAX_AGE_VARIABLE];
	const adminRaw = process.env[SESSION_ADMIN_MAX_AGE_VARIABLE];
	const idleRaw = process.env[SESSION_IDLE_TIMEOUT_VARIABLE];
	const raw = [userRaw, adminRaw, idleRaw];
	if (memo?.raw.every((value, index) => value === raw[index])) {
		return memo.policy;
	}
	const userMinutes = isUnset(userRaw)
		? DEFAULT_SESSION_MAX_AGE_MINUTES
		: parseMinutes(SESSION_USER_MAX_AGE_VARIABLE, userRaw as string);
	const adminMinutes = isUnset(adminRaw)
		? DEFAULT_SESSION_MAX_AGE_MINUTES
		: parseMinutes(SESSION_ADMIN_MAX_AGE_VARIABLE, adminRaw as string);
	const idleMinutes = isUnset(idleRaw)
		? undefined
		: parseMinutes(SESSION_IDLE_TIMEOUT_VARIABLE, idleRaw as string);
	const policy: SessionPolicy = {
		userMaxAgeSeconds: userMinutes * 60,
		adminMaxAgeSeconds: adminMinutes * 60,
		idleTimeoutSeconds:
			idleMinutes === undefined ? undefined : idleMinutes * 60,
	};
	memo = { raw, policy };
	return policy;
}

/**
 * The session policy in force, or `undefined` when it cannot be used.
 *
 * A configuration that does not parse is never quietly replaced by the
 * defaults: an idle timeout that does not parse must not turn into "no idle
 * timeout". A caller that gets `undefined` keeps every route locked.
 */
export function sessionPolicy(): SessionPolicy | undefined {
	try {
		return readSessionPolicy();
	} catch {
		return undefined;
	}
}
