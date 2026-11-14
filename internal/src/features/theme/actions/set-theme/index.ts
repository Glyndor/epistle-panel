"use server";

import { cookies } from "next/headers";

import { THEME_COOKIE } from "@/features/theme/config/choices";
import { themeChoiceSchema } from "@/features/theme/schemas/theme-choice";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/session";

/** Lifetime of the theme cookie, in seconds (one year). */
const THEME_MAX_AGE_SECONDS = 365 * 24 * 60 * 60;

/**
 * Server Action: remember the chosen theme in the `theme` cookie. A Server
 * Action is a public POST endpoint, so it checks the session itself and
 * validates the value with the shared schema; anything else changes nothing
 * and reports `false`. The root layout reads the cookie on the next request
 * and paints the choice on `<html>`, so a reload shows no other theme first.
 *
 * The cookie is not `HttpOnly`: it holds one of three public words, and the
 * page that replaces the whole document after a failure of the root layout
 * (`app/global-error`) can only learn the choice in the browser.
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
	store.set(THEME_COOKIE, choice.data, {
		httpOnly: false,
		secure: true,
		sameSite: "lax",
		path: "/",
		maxAge: THEME_MAX_AGE_SECONDS,
	});
	return true;
}
