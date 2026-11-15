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
	isPreferenceErrorKey,
	type PreferenceErrorKey,
	preferencesSchema,
} from "@/features/preferences/schemas/preferences";
import type { PreferencesState } from "@/features/preferences/schemas/preferences-state";
import { writeThemeCookie } from "@/features/theme/cookie";
import { writeTimeZoneCookie } from "@/features/time-zone/cookie";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/session";
import { readOperatorRemoteImagesMode } from "@/lib/config/remote-images";
import { readOperatorTimeZone } from "@/lib/config/time-zone";

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
 * of the message list, remote images and the time zone) from the form of
 * `/app/me`. A Server Action is a public POST endpoint, so it checks the
 * session itself, and it is the last of the form's three checks (the browser's
 * attributes, the schema in the form, this).
 * It is all or nothing: every field is checked before a cookie is written, so
 * one value outside its list stores none of the others, and the answer names
 * each field that was refused. A request with no valid session stores nothing
 * and answers `failed`, the same for a missing and an expired session.
 *
 * Each choice is kept in the cookie it already had (`locale`, `theme`,
 * `list-density`, `remote-images`, `time-zone`), written by the same function
 * the control that changes it on its own uses. A choice the operator fixed
 * (the mode of the remote images, the time zone) is not written and a posted
 * attempt to change it is refused. When the per-account document of
 * preferences exists, this is where its write replaces them.
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
	const operatorZone = readOperatorTimeZone();
	const remoteImages = posted(formData, "remoteImages");
	const timeZone = posted(formData, "timeZone");
	if (operatorMode !== null && remoteImages !== undefined) {
		return {
			outcome: "refused",
			fields: { remoteImages: "notInList" },
		};
	}
	if (operatorZone !== null && timeZone !== undefined) {
		return {
			outcome: "refused",
			fields: { timeZone: "notInList" },
		};
	}
	// A choice the operator fixed is not sent by the form, so the operator's
	// value stands in its place: the schema sees a choice of its list, and the
	// cookie of that preference is left alone.
	const parsed = preferencesSchema.safeParse({
		language: posted(formData, "language"),
		theme: posted(formData, "theme"),
		density: posted(formData, "density"),
		remoteImages: operatorMode ?? remoteImages,
		timeZone: operatorZone ?? timeZone,
	});
	if (!parsed.success) {
		return {
			outcome: "refused",
			fields: refusedFields(parsed.error.issues),
		};
	}
	const {
		language,
		theme,
		density,
		remoteImages: chosen,
		timeZone: chosenZone,
	} = parsed.data;
	writeLocaleCookie(store, language);
	writeThemeCookie(store, theme);
	writeListDensityCookie(store, density);
	if (operatorMode === null) {
		writeRemoteImagesCookie(store, chosen);
	}
	if (operatorZone === null) {
		writeTimeZoneCookie(store, chosenZone);
	}
	return {
		outcome: "saved",
		values: {
			language,
			theme,
			density,
			remoteImages: chosen,
			timeZone: chosenZone,
		},
	};
}
