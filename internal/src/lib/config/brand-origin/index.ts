import { ConfigError } from "../config-error";
import { parseHttpsOrigin } from "../https-origin";

export const BRAND_ORIGIN_VARIABLE = "EPISTLE_PANEL_BRAND_ORIGIN";

/**
 * The origin the operator named for the logo and the favicon, or `null` when
 * they named none. A value that is not one exact `https` origin stops the
 * server; the error names the variable and never its value.
 */
export function readOperatorBrandOrigin(): string | null {
	const value = (process.env[BRAND_ORIGIN_VARIABLE] ?? "").trim();
	if (value === "") {
		return null;
	}
	const origin = parseHttpsOrigin(value);
	if (origin === undefined) {
		throw new ConfigError(
			`${BRAND_ORIGIN_VARIABLE} is set to a value that is not one exact https origin`,
		);
	}
	return origin;
}
