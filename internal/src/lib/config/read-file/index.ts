import "server-only";

import { constants } from "node:fs";
import { open } from "node:fs/promises";

/** Raised when a file is larger than the cap it was read under. */
export class FileTooLargeError extends Error {}

/**
 * Open flags for an operator-supplied file. `O_NOFOLLOW` makes the open fail
 * when the last path component is a symlink, and `O_NONBLOCK` keeps a FIFO from
 * blocking the open before the file type can be checked. Both are undefined on
 * Windows, which this panel never runs on (it ships as a Linux container), so
 * they fall back to 0 there. `O_NOFOLLOW` does not cover symlinks in the parent
 * directories: the directory holding the file is trusted to be root-owned.
 */
const OPEN_FLAGS =
	constants.O_RDONLY |
	(constants.O_NOFOLLOW ?? 0) |
	(constants.O_NONBLOCK ?? 0);

/**
 * Read a file through one open file descriptor.
 *
 * The type check and the read use the same descriptor, so the file cannot be
 * swapped between them. Refuses anything that is not a regular file (symlink,
 * device, FIFO, directory) and anything over `maxBytes`, without ever buffering
 * more than the cap plus one byte. Secrets, the theme stylesheet and the brand
 * images all go through here.
 */
export async function readRegularFile(
	path: string,
	maxBytes: number,
): Promise<Buffer> {
	const handle = await open(path, OPEN_FLAGS);
	try {
		const info = await handle.stat();
		if (!info.isFile()) {
			throw new Error("not a regular file");
		}
		if (info.size > maxBytes) {
			throw new FileTooLargeError();
		}
		const buffer = Buffer.alloc(maxBytes + 1);
		const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
		if (bytesRead > maxBytes) {
			throw new FileTooLargeError();
		}
		return buffer.subarray(0, bytesRead);
	} finally {
		await handle.close();
	}
}
