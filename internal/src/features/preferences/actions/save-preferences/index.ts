"use server";

import { cookies } from "next/headers";

import { writeLocaleCookie } from "@/features/locale/cookie";
import { writeListDensityCookie } from "@/features/mail/cookie/list-density";
import { writePageSizeCookie } from "@/features/mail/cookie/page-size";
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
import { writeRefreshCookie } from "@/features/refresh/cookie";
import { writeThemeCookie } from "@/features/theme/cookie";
import { writeTimeZoneCookie } from "@/features/time-zone/cookie";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/session";
import { readOperatorPageSize } from "@/lib/config/page-size";
import { readOperatorRefreshPace } from "@/lib/config/refresh";
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

/** The fields an operator can fix for everyone with a variable. */
const OPERATOR_FIELDS = [
	"remoteImages",
	"timeZone",
	"pageSize",
	"refresh",
] as const satisfies readonly PreferenceField[];

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
 * of the message list, remote images, the time zone, the page size of the list
 * and the pace of the refreshes) from the form of
 * `/app/me`. A Server Action is a public POST endpoint, so it checks the
 * session itself, and it is the last of the form's three checks (the browser's
 * attributes, the schema in the form, this).
 * It is all or nothing: every field is checked before a cookie is written, so
 * one value outside its list stores none of the others, and the answer names
 * each field that was refused. A request with no valid session stores nothing
 * and answers `failed`, the same for a missing and an expired session.
 *
 * Each choice is kept in the cookie it already had (`locale`, `theme`,
 * `list-density`, `remote-images`, `time-zone`, `page-size`, `refresh`),
 * written by the same function the control that changes it on its own uses. A
 * choice the operator fixed (the mode of the remote images, the time zone, the
 * page size, the refresh pace) is not written and a posted attempt to change
 * it is refused. When the per-account document of
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
	const operator = {
		remoteImages: readOperatorRemoteImagesMode(),
		timeZone: readOperatorTimeZone(),
		pageSize: readOperatorPageSize(),
		refresh: readOperatorRefreshPace(),
	};
	// A choice the operator fixed is refused when it is posted, every one that
	// was, so the answer names each of them.
	const fixedAndPosted = OPERATOR_FIELDS.filter(
		(name) =>
			operator[name] !== null && posted(formData, name) !== undefined,
	);
	if (fixedAndPosted.length > 0) {
		return {
			outcome: "refused",
			fields: Object.fromEntries(
				fixedAndPosted.map((name) => [name, "notInList"] as const),
			),
		};
	}
	// A choice the operator fixed is not sent by the form, so the operator's
	// value stands in its place: the schema sees a choice of its list, and the
	// cookie of that preference is left alone.
	const parsed = preferencesSchema.safeParse({
		language: posted(formData, "language"),
		theme: posted(formData, "theme"),
		density: posted(formData, "density"),
		remoteImages: operator.remoteImages ?? posted(formData, "remoteImages"),
		timeZone: operator.timeZone ?? posted(formData, "timeZone"),
		pageSize: operator.pageSize ?? posted(formData, "pageSize"),
		refresh: operator.refresh ?? posted(formData, "refresh"),
	});
	if (!parsed.success) {
		return {
			outcome: "refused",
			fields: refusedFields(parsed.error.issues),
		};
	}
	const values = parsed.data;
	writeLocaleCookie(store, values.language);
	writeThemeCookie(store, values.theme);
	writeListDensityCookie(store, values.density);
	if (operator.remoteImages === null) {
		writeRemoteImagesCookie(store, values.remoteImages);
	}
	if (operator.timeZone === null) {
		writeTimeZoneCookie(store, values.timeZone);
	}
	if (operator.pageSize === null) {
		writePageSizeCookie(store, values.pageSize);
	}
	if (operator.refresh === null) {
		writeRefreshCookie(store, values.refresh);
	}
	return { outcome: "saved", values };
}
