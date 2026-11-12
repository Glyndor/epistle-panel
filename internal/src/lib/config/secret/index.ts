import "server-only";

import { readFile } from "node:fs/promises";

/**
 * Resolve a secret from the environment.
 *
 * `<NAME>_FILE` names a file whose content is the secret (the shape container
 * secrets are mounted in, for example `/run/secrets/<name>`). It wins over a
 * plain `<NAME>` when both are set. Trailing whitespace, such as the newline
 * most editors append, is stripped from the file content.
 *
 * Returns `undefined` when neither variable is configured, so the caller keeps
 * its own fail-closed behaviour. Throws when `<NAME>_FILE` is set but the file
 * cannot be read or holds no secret: an unusable file never falls back to the
 * plain variable, which could silently run with a weaker value. The error
 * names the variable only, never the path or the content.
 */
export async function readSecret(name: string): Promise<string | undefined> {
	const fileVar = `${name}_FILE`;
	const path = process.env[fileVar];
	if (path === undefined) {
		return process.env[name] || undefined;
	}

	let content: string;
	try {
		content = await readFile(path, "utf8");
	} catch {
		throw new Error(`${fileVar} is set but the file cannot be read`);
	}
	const secret = content.trimEnd();
	if (secret === "") {
		throw new Error(`${fileVar} is set but the file is empty`);
	}
	return secret;
}
