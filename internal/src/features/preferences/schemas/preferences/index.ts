import * as z from "zod/mini";

import { LIST_DENSITIES } from "@/features/mail/config/list-density";
import { PAGE_SIZE_CHOICES } from "@/features/mail/config/page-size";
import { REMOTE_IMAGE_MODES } from "@/features/mail/config/remote-images";
import { REFRESH_PACES } from "@/features/refresh/config/pace";
import { THEME_CHOICES } from "@/features/theme/config/choices";
import { TIME_ZONES } from "@/features/time-zone/config/zones";
import { SUPPORTED_LOCALES } from "@/i18n/locales";

/**
 * The messages a refused field can carry, as keys of the `me` namespace:
 * nothing was sent for it, or what was sent is not one of its choices. The
 * server's answer uses the same two, so a field says the same thing whichever
 * of the three checks (the browser's, this schema in the form, the Server
 * Action) caught it.
 */
export const PREFERENCE_ERROR_KEYS = ["required", "notInList"] as const;
export type PreferenceErrorKey = (typeof PREFERENCE_ERROR_KEYS)[number];

/** Whether a message is one of the {@link PREFERENCE_ERROR_KEYS}. */
export function isPreferenceErrorKey(
	message: unknown,
): message is PreferenceErrorKey {
	return PREFERENCE_ERROR_KEYS.includes(message as PreferenceErrorKey);
}

/** What a field that was not sent, or was sent empty, or sent more than once, is told. */
function refusal(issue: { input?: unknown }): PreferenceErrorKey {
	return issue.input === undefined ||
		issue.input === null ||
		issue.input === ""
		? "required"
		: "notInList";
}

/**
 * The three fields no operator can take away: the language, the theme and the
 * density of the message list. Each one is a choice of a closed list, exactly
 * as the list spells it.
 */
export const editablePreferencesSchema = z.object({
	language: z.enum(SUPPORTED_LOCALES, { error: refusal }),
	theme: z.enum(THEME_CHOICES, { error: refusal }),
	density: z.enum(LIST_DENSITIES, { error: refusal }),
});

/**
 * The preferences form: one choice from a closed list for each field, exactly
 * as the list spells it. The same schema is the form's fail-fast help in the
 * browser and the Server Action's gate, which is the real one. Nothing is
 * trimmed, lower-cased or otherwise made to fit: `ES` is not `es`. It is
 * `zod/mini` because the form ships it to the browser.
 *
 * The four fields an operator can fix (the mode of the remote images, the
 * time zone, the page size and the refresh pace) are on it too: the Server Action puts the operator's value in
 * place of the one that was not sent, so the schema always sees a choice.
 */
export const preferencesSchema = z.extend(editablePreferencesSchema, {
	remoteImages: z.enum(REMOTE_IMAGE_MODES, { error: refusal }),
	timeZone: z.enum(TIME_ZONES, { error: refusal }),
	pageSize: z.enum(PAGE_SIZE_CHOICES, { error: refusal }),
	refresh: z.enum(REFRESH_PACES, { error: refusal }),
});

/** The values of a valid form. */
export type PreferencesInput = z.infer<typeof editablePreferencesSchema>;
export type PreferencesValues = z.input<typeof preferencesSchema>;
