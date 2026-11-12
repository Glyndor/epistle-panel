import "server-only";

import { ConfigError } from "@/lib/config/config-error";
import {
	isOperatorFileConfigured,
	readOperatorFile,
} from "@/lib/config/operator-file";

/** Environment variable that names the operator's override stylesheet. */
export const THEME_CSS_VARIABLE = "EPISTLE_PANEL_THEME_CSS_FILE";

/** Largest override stylesheet accepted, in bytes. */
export const MAX_THEME_BYTES = 128 * 1024;

/** Whether an override stylesheet is configured; the file is not read. */
export function isThemeConfigured(): boolean {
	return isOperatorFileConfigured(THEME_CSS_VARIABLE);
}

/**
 * The operator's override stylesheet, or `undefined` when none is configured.
 * It is served as it is: the panel's `style-src 'self'` keeps it from loading
 * anything off the panel's origin, and it only restyles through the CSS
 * variables `theme.css` defines. Throws `ConfigError` for an unusable file or
 * one that is not text.
 */
export async function readThemeCss(): Promise<string | undefined> {
	const bytes = await readOperatorFile(THEME_CSS_VARIABLE, MAX_THEME_BYTES);
	if (bytes === undefined) {
		return undefined;
	}
	let css: string;
	try {
		css = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
	} catch {
		throw new ConfigError(
			`${THEME_CSS_VARIABLE} is set but the file is not text`,
		);
	}
	if (css.includes("\0")) {
		throw new ConfigError(
			`${THEME_CSS_VARIABLE} is set but the file is not text`,
		);
	}
	return css;
}
