import { expect } from "bun:test";

import { parseApiUrl } from "../../api-url";
import { ConfigError } from "../../config-error";

/**
 * Run `parseApiUrl` and return the origin or the error. Any error that is not
 * a `ConfigError` fails the calling test, with the value left out of the message.
 */
export function outcome(
	raw: string,
	allow: readonly string[] = [],
): { origin: string } | { error: ConfigError } {
	try {
		return { origin: parseApiUrl(raw, allow) };
	} catch (error) {
		expect(error instanceof ConfigError).toBe(true);
		return { error: error as ConfigError };
	}
}
