/**
 * The themes a person can choose. This is the only list: the menu, the Server
 * Action's schema, the cookie resolution, the root layout and the tests read
 * it. `system` is not a theme of its own: it means "follow the browser's
 * `prefers-color-scheme`", which is what the panel does with no choice made.
 */
export const THEME_CHOICES = ["system", "light", "dark"] as const;
export type ThemeChoice = (typeof THEME_CHOICES)[number];

/** A choice that pins the theme, whatever the browser prefers. */
export type ForcedTheme = Exclude<ThemeChoice, "system">;

/** The choice when the cookie is missing or holds anything else. */
export const DEFAULT_THEME_CHOICE: ThemeChoice = "system";

/** Name of the cookie that holds the chosen theme. */
export const THEME_COOKIE = "theme";

/**
 * The attribute of `<html>` that pins the theme. The stylesheet
 * (`styles/theme.css`) reads `light` and `dark`; without the attribute the
 * tokens follow `prefers-color-scheme`.
 */
export const THEME_ATTRIBUTE = "data-theme";

/** Whether a value is one of the {@link THEME_CHOICES}, exactly. */
export function isThemeChoice(value: unknown): value is ThemeChoice {
	return THEME_CHOICES.includes(value as ThemeChoice);
}

/** A stored value as a choice: anything that is not exactly a choice is `system`. */
export function parseThemeChoice(value: unknown): ThemeChoice {
	return isThemeChoice(value) ? value : DEFAULT_THEME_CHOICE;
}

/** The value of the {@link THEME_ATTRIBUTE} for a choice; `system` has none. */
export function forcedTheme(choice: ThemeChoice): ForcedTheme | undefined {
	return choice === "system" ? undefined : choice;
}
