/**
 * The fields of the preferences form, by the name the browser posts them
 * under. This is the only list: the form, the schema, the Server Action and
 * the tests read it. Each field is a closed choice, and its list lives with
 * the thing it chooses (`i18n/locales`, `features/theme/config/choices`,
 * `features/mail/config/list-density`, `features/mail/config/remote-images`,
 * `features/time-zone/config/zones`, `features/mail/config/page-size`,
 * `features/refresh/config/pace`).
 */
export const PREFERENCE_FIELDS = [
	"language",
	"theme",
	"density",
	"remoteImages",
	"timeZone",
	"pageSize",
	"refresh",
] as const;
export type PreferenceField = (typeof PREFERENCE_FIELDS)[number];
