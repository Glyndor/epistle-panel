import { ConfigError } from "../config-error";
import { parseHttpsOrigin } from "../https-origin";

export const STATIC_ORIGIN_VARIABLE = "EPISTLE_PANEL_STATIC_ORIGIN";

/**
 * The origin the operator named for the files under `/_next/static`, or `null`
 * when they named none. A value that is not one exact `https` origin stops the
 * server; the error names the variable and never its value.
 *
 * Next fixes `assetPrefix` when it builds, into the markup the server writes
 * and into the code the browser runs to load its chunks, so this variable is
 * read twice: by `next.config.ts` during the build, and by the server at start,
 * where it must still name the origin the build used (see
 * `checkStaticOriginAtStart`).
 */
export function readOperatorStaticOrigin(): string | null {
	const value = (process.env[STATIC_ORIGIN_VARIABLE] ?? "").trim();
	if (value === "") {
		return null;
	}
	const origin = parseHttpsOrigin(value);
	if (origin === undefined) {
		throw new ConfigError(
			`${STATIC_ORIGIN_VARIABLE} is set to a value that is not one exact https origin`,
		);
	}
	return origin;
}

/**
 * The origin this build was made for, or `null` for a build whose static files
 * are served by the panel itself. It is the value the markup and the chunk
 * loader really carry, so it is the one the policy follows.
 */
export function builtStaticOrigin(): string | null {
	const value = process.env.PANEL_BUILT_STATIC_ORIGIN;
	return value === undefined || value === "" ? null : value;
}

/**
 * The two `next.config.ts` settings a static origin turns on: Next's
 * `assetPrefix`, and the value the server reads back as
 * {@link builtStaticOrigin}. With no origin there is nothing to set, and the
 * build is the one the panel always made.
 */
export function staticOriginBuildConfig(origin: string | null): {
	assetPrefix?: string;
	env?: { PANEL_BUILT_STATIC_ORIGIN: string };
} {
	return origin === null
		? {}
		: {
				assetPrefix: origin,
				env: { PANEL_BUILT_STATIC_ORIGIN: origin },
			};
}
