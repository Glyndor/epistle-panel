"use server";

import { cookies } from "next/headers";

import { writeListDensityCookie } from "@/features/mail/cookie/list-density";
import { listDensitySchema } from "@/features/mail/schemas/list-density";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/session";

/**
 * Server Action: remember the chosen density of the message list (the button
 * of the list's toolbar). A Server Action is a public POST endpoint, so it
 * checks the session itself and validates the value with the shared schema;
 * anything else changes nothing and reports `false`. The list pane reads the
 * cookie on the next request and paints the choice with the first frame. The
 * preferences page writes the same cookie through the same writer.
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
	writeListDensityCookie(store, density.data);
	return true;
}
