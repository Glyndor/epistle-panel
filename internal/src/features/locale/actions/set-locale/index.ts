"use server";

import { cookies } from "next/headers";

import { localeSchema } from "@/features/locale/schemas/locale";
import { LOCALE_COOKIE } from "@/i18n/locales";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/session";

/** Lifetime of the locale cookie, in seconds (one year). */
const LOCALE_MAX_AGE_SECONDS = 365 * 24 * 60 * 60;

/**
 * Server Action: remember the interface language in the `locale` cookie. A
 * Server Action is a public POST endpoint, so it checks the session itself and
 * validates the value with the shared schema; anything else changes nothing and
 * reports `false`. The page re-renders with the new cookie after the action.
 */
export async function setLocale(value: string): Promise<boolean> {
	const store = await cookies();
	if (!(await verifySession(store.get(SESSION_COOKIE)?.value))) {
		return false;
	}
	const locale = localeSchema.safeParse(value);
	if (!locale.success) {
		return false;
	}
	store.set(LOCALE_COOKIE, locale.data, {
		httpOnly: true,
		secure: true,
		sameSite: "lax",
		path: "/",
		maxAge: LOCALE_MAX_AGE_SECONDS,
	});
	return true;
}
