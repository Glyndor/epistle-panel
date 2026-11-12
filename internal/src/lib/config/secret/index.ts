import "server-only";

import { constants } from "node:fs";
import { open } from "node:fs/promises";
import { isAbsolute } from "node:path";

import { ConfigError } from "../config-error";

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

/** Raised internally when a secret file exceeds `MAX_SECRET_BYTES`. */
class SecretTooLargeError extends Error {}

/**
 * Open flags for a secret file. `O_NOFOLLOW` makes the open fail when the last
 * path component is a symlink, and `O_NONBLOCK` keeps a FIFO from blocking the
 * open before the file type can be checked. Both are undefined on Windows, which
 * this panel never runs on (it ships as a Linux container), so they fall back
 * to 0 there. `O_NOFOLLOW` does not cover symlinks in the parent directories:
 * the directory holding the secrets is trusted to be root-owned.
 */
const OPEN_FLAGS =
	constants.O_RDONLY |
	(constants.O_NOFOLLOW ?? 0) |
	(constants.O_NONBLOCK ?? 0);

/**
 * Read a secret file through one open file descriptor.
 *
 * The type check and the read use the same descriptor, so the file cannot be
 * swapped between them. Refuses anything that is not a regular file (symlink,
 * device, FIFO, directory) and anything over `MAX_SECRET_BYTES`, without ever
 * buffering more than the cap plus one byte.
 */
async function readSecretFile(path: string): Promise<string> {
	const handle = await open(path, OPEN_FLAGS);
	try {
		const info = await handle.stat();
		if (!info.isFile()) {
			throw new Error("not a regular file");
		}
		if (info.size > MAX_SECRET_BYTES) {
			throw new SecretTooLargeError();
		}
		const buffer = Buffer.alloc(MAX_SECRET_BYTES + 1);
		const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
		if (bytesRead > MAX_SECRET_BYTES) {
			throw new SecretTooLargeError();
		}
		return buffer.toString("utf8", 0, bytesRead);
	} finally {
		await handle.close();
	}
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
		content = await readSecretFile(path);
	} catch (error) {
		if (error instanceof SecretTooLargeError) {
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
