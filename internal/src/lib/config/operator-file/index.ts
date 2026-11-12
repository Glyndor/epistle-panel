import "server-only";

import { isAbsolute } from "node:path";

import { ConfigError } from "../config-error";
import { FileTooLargeError, readRegularFile } from "../read-file";

/**
 * Read the file an operator named in an environment variable, for content that
 * is not a secret (the theme stylesheet, the brand images).
 *
 * Returns `undefined` when the variable is not set. The path must be absolute;
 * the file must be a regular file (not a symlink) of at most `maxBytes`. It is
 * read on every call, so an operator can change a mounted file without
 * restarting; callers that need less I/O cache by themselves. Throws
 * `ConfigError` when the variable is set but the file cannot be used; the
 * message names the variable only, never the path or the content.
 */
export async function readOperatorFile(
	variable: string,
	maxBytes: number,
): Promise<Buffer | undefined> {
	const path = process.env[variable];
	if (path === undefined || path === "") {
		return undefined;
	}
	if (!isAbsolute(path)) {
		throw new ConfigError(`${variable} is set but is not an absolute path`);
	}
	try {
		return await readRegularFile(path, maxBytes);
	} catch (error) {
		if (error instanceof FileTooLargeError) {
			throw new ConfigError(
				`${variable} is set but the file is too large`,
			);
		}
		throw new ConfigError(`${variable} is set but the file cannot be read`);
	}
}

/** Whether the variable is set to a non-empty value, without touching the file. */
export function isOperatorFileConfigured(variable: string): boolean {
	return (process.env[variable] ?? "") !== "";
}
