"use server";

import { cookies } from "next/headers";

import { writeThemeCookie } from "@/features/theme/cookie";
import { themeChoiceSchema } from "@/features/theme/schemas/theme-choice";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/session";

/**
 * Server Action: remember the chosen theme (the theme button of the header
 * and the account menu). A Server Action is a public POST endpoint, so it
 * checks the session itself and validates the value with the shared schema;
 * anything else changes nothing and reports `false`. The preferences page
 * writes the same cookie through the same writer.
 */
export async function setTheme(value: string): Promise<boolean> {
	const store = await cookies();
	if (!(await verifySession(store.get(SESSION_COOKIE)?.value))) {
		return false;
	}
	const choice = themeChoiceSchema.safeParse(value);
	if (!choice.success) {
		return false;
	}
	writeThemeCookie(store, choice.data);
	return true;
}
