import "server-only";

import { isAbsolute } from "node:path";

import { ConfigError } from "../config-error";
import { FileTooLargeError, readRegularFile } from "../read-file";

/** Largest secret file accepted, in bytes. Real secrets are a few dozen. */
export const MAX_SECRET_BYTES = 64 * 1024;

/**
 * Key of the process-wide cache on `globalThis`. The proxy, the pages and the
 * server actions are bundled separately, so a module-level `Map` would give
 * each bundle its own copy: after a rotation without a restart the proxy could
 * read the new session secret while the sign-in action kept signing with the
 * old one, and no session would verify. The shared registry makes "read once
 * per process" true for every bundle, like the revocation set and the limiter.
 */
const CACHE = Symbol.for("epistle-panel.secret-cache");

/**
 * File secrets read by this process, keyed by variable name and path.
 *
 * Reading once per process closes the window in which someone able to write
 * the secrets directory could swap the file between two requests. Rotation
 * does not need a refresh path: `epistle stack update` renews the secret file
 * and restarts the service, so the new process reads the new value. Failures
 * are never cached, so a file that was not ready at first use is read again.
 */
function cache(): Map<string, string> {
	const holder = globalThis as unknown as Record<
		symbol,
		Map<string, string> | undefined
	>;
	holder[CACHE] ??= new Map();
	return holder[CACHE];
}

/**
 * Forget every cached file secret.
 *
 * The only invalidation there is. Production never calls it, since a rotation
 * restarts the process; tests call it to read a file they rewrote.
 */
export function clearSecretCache(): void {
	cache().clear();
}

/**
 * Resolve a secret from the environment.
 *
 * `<NAME>_FILE` names a file whose content is the secret (the shape container
 * secrets are mounted in, for example `/run/secrets/<name>`). It wins over a
 * plain `<NAME>` when both are set. Trailing whitespace, such as the newline
 * most editors append, is stripped from the file content.
 *
 * The path must be absolute, so the value never depends on the working
 * directory. The file must be a regular file (not a symlink) of at most
 * `MAX_SECRET_BYTES`. A value read from a file is cached for the life of the
 * process; see `clearSecretCache`.
 *
 * Returns `undefined` when neither variable is configured, so the caller keeps
 * its own fail-closed behaviour. Throws when `<NAME>_FILE` is set but the file
 * cannot be used or holds no secret: an unusable file never falls back to the
 * plain variable, which could silently run with a weaker value. The error
 * names the variable only, never the path or the content.
 */
export async function readSecret(name: string): Promise<string | undefined> {
	const fileVar = `${name}_FILE`;
	const path = process.env[fileVar];
	if (path === undefined) {
		return process.env[name] || undefined;
	}
	if (!isAbsolute(path)) {
		throw new ConfigError(`${fileVar} is set but is not an absolute path`);
	}

	const key = `${name}\0${path}`;
	const cached = cache().get(key);
	if (cached !== undefined) {
		return cached;
	}

	let content: string;
	try {
		content = (await readRegularFile(path, MAX_SECRET_BYTES)).toString(
			"utf8",
		);
	} catch (error) {
		if (error instanceof FileTooLargeError) {
			throw new ConfigError(
				`${fileVar} is set but the file is too large`,
			);
		}
		throw new ConfigError(`${fileVar} is set but the file cannot be read`);
	}
	const secret = content.trimEnd();
	if (secret === "") {
		throw new ConfigError(`${fileVar} is set but the file is empty`);
	}
	cache().set(key, secret);
	return secret;
}
