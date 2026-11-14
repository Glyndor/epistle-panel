"use server";

import { cookies } from "next/headers";

import { LIST_DENSITY_COOKIE } from "@/features/mail/config/list-density";
import { listDensitySchema } from "@/features/mail/schemas/list-density";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/session";

/** Lifetime of the density cookie, in seconds (one year). */
const DENSITY_MAX_AGE_SECONDS = 365 * 24 * 60 * 60;

/**
 * Server Action: remember the chosen density of the message list in the
 * `mail-density` cookie. A Server Action is a public POST endpoint, so it
 * checks the session itself and validates the value with the shared schema;
 * anything else changes nothing and reports `false`. The list pane reads the
 * cookie on the next request and paints the choice with the first frame.
 *
 * The cookie is `HttpOnly`: only the server reads it, and the control learns
 * the choice from the page the server rendered. It holds one of two public
 * words and no secret.
 */
export async function setListDensity(value: string): Promise<boolean> {
	const store = await cookies();
	if (!(await verifySession(store.get(SESSION_COOKIE)?.value))) {
		return false;
	}
	const density = listDensitySchema.safeParse(value);
	if (!density.success) {
		return false;
	}
	store.set(LIST_DENSITY_COOKIE, density.data, {
		httpOnly: true,
		secure: true,
		sameSite: "lax",
		path: "/app/mail",
		maxAge: DENSITY_MAX_AGE_SECONDS,
	});
	return true;
}
