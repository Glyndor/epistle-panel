"use server";

import { cookies } from "next/headers";

import { writeLocaleCookie } from "@/features/locale/cookie";
import { writeListDensityCookie } from "@/features/mail/cookie/list-density";
import {
	PREFERENCE_FIELDS,
	type PreferenceField,
} from "@/features/preferences/config/fields";
import {
	isPreferenceErrorKey,
	type PreferenceErrorKey,
	preferencesSchema,
} from "@/features/preferences/schemas/preferences";
import type { PreferencesState } from "@/features/preferences/schemas/preferences-state";
import { writeThemeCookie } from "@/features/theme/cookie";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/session";

/**
 * One field of the posted form as the schema is to read it: its value when it
 * was sent once. Not sent at all is `undefined` (required); sent more than
 * once is the list of what was sent, which no choice is (outside the list). A
 * file is no choice either, and the schema says so.
 */
function posted(formData: FormData, name: PreferenceField): unknown {
	const values = formData.getAll(name);
	if (values.length === 0) {
		return undefined;
	}
	return values.length === 1 ? values[0] : values;
}

/**
 * Server Action: save the person's preferences (language, theme, the density
 * of the message list) from the form of `/app/me`. A Server Action is a public
 * POST endpoint, so it checks the session itself, and it is the last of the
 * form's three checks (the browser's attributes, the schema in the form, this).
 * It is all or nothing: every field is checked before a cookie is written, so
 * one value outside its list stores none of the others, and the answer names
 * each field that was refused. A request with no valid session stores nothing
 * and answers `failed`, the same for a missing and an expired session.
 *
 * Each choice is kept in the cookie it already had (`locale`, `theme`,
 * `list-density`), written by the same function the control that changes it
 * on its own uses. When the per-account document of preferences exists, this
 * is where its write replaces them.
 */
export async function savePreferences(
	_previous: PreferencesState,
	formData: FormData,
): Promise<PreferencesState> {
	const store = await cookies();
	if (!(await verifySession(store.get(SESSION_COOKIE)?.value))) {
		return { outcome: "failed" };
	}
	// A post made by hand can call the action with other arguments than the
	// form's two; with no form there is nothing to read, and nothing to store.
	if (!(formData instanceof FormData)) {
		return { outcome: "failed" };
	}
	const parsed = preferencesSchema.safeParse({
		language: posted(formData, "language"),
		theme: posted(formData, "theme"),
		density: posted(formData, "density"),
	});
	if (!parsed.success) {
		const fields: Partial<Record<PreferenceField, PreferenceErrorKey>> = {};
		for (const issue of parsed.error.issues) {
			const name = issue.path[0];
			if (
				PREFERENCE_FIELDS.includes(name as PreferenceField) &&
				isPreferenceErrorKey(issue.message)
			) {
				fields[name as PreferenceField] ??= issue.message;
			}
		}
		return { outcome: "refused", fields };
	}
	const { language, theme, density } = parsed.data;
	writeLocaleCookie(store, language);
	writeThemeCookie(store, theme);
	writeListDensityCookie(store, density);
	return { outcome: "saved", values: parsed.data };
}
