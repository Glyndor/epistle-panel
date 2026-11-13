import "server-only";

import { cookies } from "next/headers";
import type { z } from "zod";

import {
	currentMailSession,
	type MailSession,
} from "@/features/mail/jmap/credentials";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/session";
import type { ActionResult } from "@/lib/query/action-result";
import {
	runGatedAction,
	runGatedValidatedAction,
} from "@/lib/query/run-action";

/**
 * The gate of the webmail's Server Actions: a valid panel session, of any
 * role. The webmail is not part of the admin area, so its actions do not
 * depend on the admin id being configured. Without a session the answer is
 * `unauthenticated` and the client goes to the sign-in page.
 */
async function hasSession(): Promise<boolean> {
	const session = await verifySession(
		(await cookies()).get(SESSION_COOKIE)?.value,
	);
	return session !== null;
}

/**
 * The mail session of the request, inside the action body. A signed-in user
 * the credential provider has no mail session for gets `unavailable`, not
 * `unauthenticated`: sending them to the sign-in page would only bring them
 * back here, in a loop.
 */
async function mailSession(): Promise<MailSession> {
	const session = await currentMailSession();
	if (session === null) {
		throw new Error("no mail session");
	}
	return session;
}

/** Run a webmail Server Action for the request's mail session. */
export function runMailAction<T>(
	operation: string,
	load: (session: MailSession) => Promise<T>,
): Promise<ActionResult<T>> {
	return runGatedAction(hasSession, operation, async () =>
		load(await mailSession()),
	);
}

/** {@link runMailAction} for an action that takes input, parsed before `load` runs. */
export function runValidatedMailAction<S extends z.ZodType, T>(
	operation: string,
	schema: S,
	input: unknown,
	load: (session: MailSession, data: z.output<S>) => Promise<T>,
): Promise<ActionResult<T>> {
	return runGatedValidatedAction(
		hasSession,
		operation,
		schema,
		input,
		async (data) => load(await mailSession(), data),
	);
}
