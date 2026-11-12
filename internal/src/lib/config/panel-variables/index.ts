/** Prefix of every variable the panel reads for its own configuration. */
export const PANEL_VARIABLE_PREFIX = "EPISTLE_PANEL_";

/**
 * Every `EPISTLE_PANEL_` variable the panel reads, the one list the startup
 * warning checks against. A test scans the source for `EPISTLE_PANEL_` names and
 * fails when one is missing here, so a variable cannot be added to the code
 * without being listed.
 */
export const PANEL_VARIABLES: readonly string[] = [
	"EPISTLE_PANEL_BRAND_FAVICON_FILE",
	"EPISTLE_PANEL_BRAND_LOGO_FILE",
	"EPISTLE_PANEL_BRAND_NAME",
	"EPISTLE_PANEL_CAPTCHA_HOSTNAME",
	"EPISTLE_PANEL_CAPTCHA_PROVIDER",
	"EPISTLE_PANEL_CAPTCHA_RESPONSE_FIELD",
	"EPISTLE_PANEL_CAPTCHA_SCRIPT_URL",
	"EPISTLE_PANEL_CAPTCHA_SECRET_KEY",
	"EPISTLE_PANEL_CAPTCHA_SITE_KEY",
	"EPISTLE_PANEL_CAPTCHA_VERIFY_URL",
	"EPISTLE_PANEL_LOGIN_MIN_MS",
	"EPISTLE_PANEL_SESSION_SECRET",
	"EPISTLE_PANEL_THEME_CSS_FILE",
];

/**
 * The variables read through `readSecret`, which also accepts `<NAME>_FILE`
 * naming a file that holds the value.
 */
export const PANEL_SECRET_VARIABLES: readonly string[] = [
	"EPISTLE_PANEL_CAPTCHA_SECRET_KEY",
	"EPISTLE_PANEL_SESSION_SECRET",
];

/** Whether the panel reads `name`, directly or as the `_FILE` form of a secret. */
export function isKnownPanelVariable(name: string): boolean {
	if (PANEL_VARIABLES.includes(name)) {
		return true;
	}
	return (
		name.endsWith("_FILE") &&
		PANEL_SECRET_VARIABLES.includes(name.slice(0, -"_FILE".length))
	);
}

/**
 * The names in `env` that start with `EPISTLE_PANEL_` and that the panel does not
 * read, sorted. Only names are returned, never values.
 */
export function unknownPanelVariables(
	env: Readonly<Record<string, string | undefined>>,
): string[] {
	return Object.keys(env)
		.filter(
			(name) =>
				name.startsWith(PANEL_VARIABLE_PREFIX) &&
				!isKnownPanelVariable(name),
		)
		.sort();
}

/**
 * Log one warning per unknown `EPISTLE_PANEL_` name. A misspelt name would
 * otherwise leave a setting at its default without a word, and a newer epistle
 * stack may pass a variable an older panel does not read, so this warns and does
 * not stop. The warning carries the name only, never the value.
 */
export function warnUnknownPanelVariables(
	env: Readonly<Record<string, string | undefined>> = process.env,
	warn: (message: string) => void = console.warn,
): void {
	for (const name of unknownPanelVariables(env)) {
		warn(
			`unknown configuration variable ${name}: it is not read by this panel`,
		);
	}
}
