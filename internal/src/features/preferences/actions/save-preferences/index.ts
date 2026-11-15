"use server";

import { cookies } from "next/headers";

import { writeLocaleCookie } from "@/features/locale/cookie";
import { writeListDensityCookie } from "@/features/mail/cookie/list-density";
import { writeRemoteImagesCookie } from "@/features/mail/cookie/remote-images";
import {
	PREFERENCE_FIELDS,
	type PreferenceField,
} from "@/features/preferences/config/fields";
import {
	editablePreferencesSchema,
	isPreferenceErrorKey,
	type PreferenceErrorKey,
	preferencesSchema,
} from "@/features/preferences/schemas/preferences";
import type { PreferencesState } from "@/features/preferences/schemas/preferences-state";
import { writeThemeCookie } from "@/features/theme/cookie";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/session";
import { readOperatorRemoteImagesMode } from "@/lib/config/remote-images";

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

function isPreferenceField(name: unknown): name is PreferenceField {
	return (
		typeof name === "string" &&
		PREFERENCE_FIELDS.some((field) => field === name)
	);
}

function refusedFields(
	issues: readonly {
		readonly path: readonly PropertyKey[];
		readonly message: string;
	}[],
): Partial<Record<PreferenceField, PreferenceErrorKey>> {
	const fields: Partial<Record<PreferenceField, PreferenceErrorKey>> = {};
	for (const issue of issues) {
		const name = issue.path[0];
		if (isPreferenceField(name) && isPreferenceErrorKey(issue.message)) {
			fields[name] ??= issue.message;
		}
	}
	return fields;
}

/**
 * Server Action: save the person's preferences (language, theme, the density
 * of the message list and remote images) from the form of `/app/me`. A Server
 * Action is a public POST endpoint, so it checks the session itself, and it is
 * the last of the form's three checks (the browser's attributes, the schema in
 * the form, this).
 * It is all or nothing: every field is checked before a cookie is written, so
 * one value outside its list stores none of the others, and the answer names
 * each field that was refused. A request with no valid session stores nothing
 * and answers `failed`, the same for a missing and an expired session.
 *
 * Each choice is kept in the cookie it already had (`locale`, `theme`,
 * `list-density`, `remote-images`), written by the same function the control
 * that changes it on its own uses. An operator-fixed remote image mode is not
 * written and a posted attempt to change it is refused. When the per-account
 * document of preferences exists, this is where its write replaces them.
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
	const operatorMode = readOperatorRemoteImagesMode();
	const remoteImages = posted(formData, "remoteImages");
	if (operatorMode !== null && remoteImages !== undefined) {
		return {
			outcome: "refused",
			fields: { remoteImages: "notInList" },
		};
	}
	const editable = {
		language: posted(formData, "language"),
		theme: posted(formData, "theme"),
		density: posted(formData, "density"),
	};
	if (operatorMode === null) {
		const parsed = preferencesSchema.safeParse({
			...editable,
			remoteImages,
		});
		if (!parsed.success) {
			return {
				outcome: "refused",
				fields: refusedFields(parsed.error.issues),
			};
		}
		const { language, theme, density, remoteImages: chosen } = parsed.data;
		if (chosen === undefined) {
			return {
				outcome: "refused",
				fields: { remoteImages: "required" },
			};
		}
		writeLocaleCookie(store, language);
		writeThemeCookie(store, theme);
		writeListDensityCookie(store, density);
		writeRemoteImagesCookie(store, chosen);
		return {
			outcome: "saved",
			values: { language, theme, density, remoteImages: chosen },
		};
	}
	const parsed = editablePreferencesSchema.safeParse(editable);
	if (!parsed.success) {
		return {
			outcome: "refused",
			fields: refusedFields(parsed.error.issues),
		};
	}
	const { language, theme, density } = parsed.data;
	writeLocaleCookie(store, language);
	writeThemeCookie(store, theme);
	writeListDensityCookie(store, density);
	return {
		outcome: "saved",
		values: { ...parsed.data, remoteImages: operatorMode },
	};
}
