/**
 * The fields of the preferences form, by the name the browser posts them
 * under. This is the only list: the form, the schema, the Server Action and
 * the tests read it. Each field is a closed choice, and its list lives with
 * the thing it chooses (`i18n/locales`, `features/theme/config/choices`,
 * `features/mail/config/list-density`).
 */
export const PREFERENCE_FIELDS = ["language", "theme", "density"] as const;
export type PreferenceField = (typeof PREFERENCE_FIELDS)[number];
