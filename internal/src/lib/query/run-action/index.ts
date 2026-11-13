import "server-only";

import { cookies } from "next/headers";
import type { z } from "zod";

import { logApiFailure } from "@/lib/api/log-failure";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/session";
import { readAdminId } from "@/lib/config/admin-id";
import type { ActionResult } from "@/lib/query/action-result";

/**
 * Whether the caller holds a session with the admin role in an installation
 * whose admin area is on. Every action that goes through this module is an
 * admin action, so a session of another role is no session here.
 */
async function hasSession(): Promise<boolean> {
	const session = await verifySession(
		(await cookies()).get(SESSION_COOKIE)?.value,
	);
	return session?.role === "admin" && (await readAdminId()) !== undefined;
}

/**
 * Run the body of a Server Action behind a gate the caller names. `allowed`
 * decides whether the caller may run it at all; without it the answer is
 * `unauthenticated` and `load` never runs. A failure inside `load` is written
 * to the server log with the fixed `operation` name (see `describeFailure`)
 * and reported as `unavailable`, with nothing of the error. The token and the
 * raw API error never reach the browser.
 */
export async function runGatedAction<T>(
	allowed: () => Promise<boolean>,
	operation: string,
	load: () => Promise<T>,
): Promise<ActionResult<T>> {
	if (!(await allowed())) {
		return { ok: false, reason: "unauthenticated" };
	}
	try {
		return { ok: true, data: await load() };
	} catch (error) {
		logApiFailure(operation, error);
		return { ok: false, reason: "unavailable" };
	}
}

/**
 * {@link runGatedAction} for an action that takes input. The gate is checked
 * first, so a caller who may not run it learns nothing about the schema; then
 * the input is parsed with `schema`, the one the client builds its request
 * from, and anything that does not parse is `invalid` and never reaches
 * `load`. `load` gets the parsed value, never the raw input.
 */
export async function runGatedValidatedAction<S extends z.ZodType, T>(
	allowed: () => Promise<boolean>,
	operation: string,
	schema: S,
	input: unknown,
	load: (data: z.output<S>) => Promise<T>,
): Promise<ActionResult<T>> {
	if (!(await allowed())) {
		return { ok: false, reason: "unauthenticated" };
	}
	const parsed = schema.safeParse(input);
	if (!parsed.success) {
		return { ok: false, reason: "invalid" };
	}
	try {
		return { ok: true, data: await load(parsed.data) };
	} catch (error) {
		logApiFailure(operation, error);
		return { ok: false, reason: "unavailable" };
	}
}

/**
 * Run the body of an admin Server Action that reads or writes through the
 * epistle API.
 *
 * A Server Action is a public POST endpoint, so the admin session is checked
 * here and not trusted to the proxy in front of it.
 */
export function runAction<T>(
	operation: string,
	load: () => Promise<T>,
): Promise<ActionResult<T>> {
	return runGatedAction(hasSession, operation, load);
}

/** {@link runAction} for an admin action that takes input, parsed before `load` runs. */
export function runValidatedAction<S extends z.ZodType, T>(
	operation: string,
	schema: S,
	input: unknown,
	load: (data: z.output<S>) => Promise<T>,
): Promise<ActionResult<T>> {
	return runGatedValidatedAction(hasSession, operation, schema, input, load);
}
