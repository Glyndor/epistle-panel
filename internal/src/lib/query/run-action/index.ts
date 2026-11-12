import "server-only";

import { cookies } from "next/headers";
import type { z } from "zod";

import { logApiFailure } from "@/lib/api/log-failure";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/session";
import type { ActionResult } from "@/lib/query/action-result";

async function hasSession(): Promise<boolean> {
	const session = await verifySession(
		(await cookies()).get(SESSION_COOKIE)?.value,
	);
	return session !== null;
}

/**
 * Run the body of a Server Action that reads or writes through the epistle API.
 *
 * A Server Action is a public POST endpoint, so the session is checked here and
 * not trusted to the proxy in front of it: without one the answer is
 * `unauthenticated` and `load` never runs. A failure inside `load` is written to
 * the server log with the fixed `operation` name (see `describeFailure`) and
 * reported as `unavailable`, with nothing of the error. The token and the raw
 * API error never reach the browser.
 */
export async function runAction<T>(
	operation: string,
	load: () => Promise<T>,
): Promise<ActionResult<T>> {
	if (!(await hasSession())) {
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
 * {@link runAction} for an action that takes input. The session is checked
 * first, so an anonymous caller learns nothing about the schema; then the input
 * is parsed with `schema`, the one the client builds its request from, and
 * anything that does not parse is `invalid` and never reaches `load`. `load`
 * gets the parsed value, never the raw input.
 */
export async function runValidatedAction<S extends z.ZodType, T>(
	operation: string,
	schema: S,
	input: unknown,
	load: (data: z.output<S>) => Promise<T>,
): Promise<ActionResult<T>> {
	if (!(await hasSession())) {
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
