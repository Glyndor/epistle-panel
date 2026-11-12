import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { execFileSync } from "node:child_process";
import {
	chmodSync,
	mkdtempSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { clearSecretCache, MAX_SECRET_BYTES, readSecret } from ".";

const NAME = "EPISTLE_TEST_SECRET";
const FILE_VAR = `${NAME}_FILE`;

let dir: string;

function secretFile(content: string): string {
	const path = join(dir, "secret");
	writeFileSync(path, content);
	return path;
}

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "epistle-secret-"));
});

afterEach(() => {
	clearSecretCache();
	delete process.env[NAME];
	delete process.env[FILE_VAR];
	rmSync(dir, { recursive: true, force: true });
});

describe("readSecret", () => {
	it("returns undefined when nothing is configured", async () => {
		expect(await readSecret(NAME)).toBeUndefined();
	});

	it("reads the plain variable", async () => {
		process.env[NAME] = "from-env";
		expect(await readSecret(NAME)).toBe("from-env");
	});

	it("treats an empty plain variable as unset", async () => {
		process.env[NAME] = "";
		expect(await readSecret(NAME)).toBeUndefined();
	});

	it("reads the file and strips trailing whitespace", async () => {
		process.env[FILE_VAR] = secretFile("from-file \r\n\n");
		expect(await readSecret(NAME)).toBe("from-file");
	});

	it("keeps leading and inner whitespace", async () => {
		process.env[FILE_VAR] = secretFile(" a b\n");
		expect(await readSecret(NAME)).toBe(" a b");
	});

	it("prefers the file over the plain variable", async () => {
		process.env[NAME] = "from-env";
		process.env[FILE_VAR] = secretFile("from-file\n");
		expect(await readSecret(NAME)).toBe("from-file");
	});

	it("fails closed on a missing file, even with a plain variable", async () => {
		process.env[NAME] = "from-env";
		process.env[FILE_VAR] = join(dir, "missing");
		await expect(readSecret(NAME)).rejects.toThrow(
			`${FILE_VAR} is set but the file cannot be read`,
		);
	});

	it("fails closed when the path is a directory", async () => {
		process.env[FILE_VAR] = dir;
		await expect(readSecret(NAME)).rejects.toThrow("cannot be read");
	});

	it("fails closed on an empty file, even with a plain variable", async () => {
		process.env[NAME] = "from-env";
		process.env[FILE_VAR] = secretFile("");
		await expect(readSecret(NAME)).rejects.toThrow(
			`${FILE_VAR} is set but the file is empty`,
		);
	});

	it("fails closed on a whitespace-only file", async () => {
		process.env[FILE_VAR] = secretFile(" \n\t\n");
		await expect(readSecret(NAME)).rejects.toThrow("file is empty");
	});

	it("fails closed on an empty path", async () => {
		process.env[NAME] = "from-env";
		process.env[FILE_VAR] = "";
		await expect(readSecret(NAME)).rejects.toThrow(
			`${FILE_VAR} is set but is not an absolute path`,
		);
	});

	it("never puts the path or the content in the error", async () => {
		const path = secretFile("");
		process.env[FILE_VAR] = path;
		const error = await readSecret(NAME).catch((e: Error) => e);
		expect((error as Error).message).not.toContain(path);
	});

	// Root ignores file modes, so the unreadable case cannot be built there.
	it.skipIf(process.getuid?.() === 0)(
		"fails closed on an unreadable file",
		async () => {
			const path = secretFile("hunter2\n");
			chmodSync(path, 0o000);
			process.env[FILE_VAR] = path;
			const error = await readSecret(NAME).catch((e: Error) => e);
			expect((error as Error).message).toContain("cannot be read");
			expect((error as Error).message).not.toContain("hunter2");
		},
	);
});

describe("readSecret file hardening", () => {
	it("rejects a relative path, even one that exists from the cwd", async () => {
		writeFileSync(join(dir, "secret"), "hunter2\n");
		const previous = process.cwd();
		process.chdir(dir);
		try {
			process.env[FILE_VAR] = "./secret";
			await expect(readSecret(NAME)).rejects.toThrow(
				`${FILE_VAR} is set but is not an absolute path`,
			);
		} finally {
			process.chdir(previous);
		}
	});

	it("rejects a symlink to a readable file", async () => {
		const target = join(dir, "target");
		writeFileSync(target, "hunter2\n");
		const link = join(dir, "link");
		symlinkSync(target, link);
		process.env[FILE_VAR] = link;
		const error = await readSecret(NAME).catch((e: Error) => e);
		expect((error as Error).message).toContain("cannot be read");
		expect((error as Error).message).not.toContain("hunter2");
	});

	it("rejects a device that never ends", async () => {
		process.env[FILE_VAR] = "/dev/zero";
		await expect(readSecret(NAME)).rejects.toThrow("cannot be read");
	});

	it("rejects a FIFO without waiting for a writer", async () => {
		const fifo = join(dir, "fifo");
		execFileSync("mkfifo", [fifo]);
		process.env[FILE_VAR] = fifo;
		await expect(readSecret(NAME)).rejects.toThrow("cannot be read");
	});

	it("rejects a file over the size cap", async () => {
		process.env[FILE_VAR] = secretFile("a".repeat(MAX_SECRET_BYTES + 1));
		await expect(readSecret(NAME)).rejects.toThrow(
			`${FILE_VAR} is set but the file is too large`,
		);
	});

	it("accepts a file exactly at the size cap", async () => {
		process.env[FILE_VAR] = secretFile("a".repeat(MAX_SECRET_BYTES));
		expect((await readSecret(NAME))?.length).toBe(MAX_SECRET_BYTES);
	});
});

describe("readSecret cache", () => {
	it("keeps the first value when the file changes", async () => {
		const path = secretFile("first\n");
		process.env[FILE_VAR] = path;
		expect(await readSecret(NAME)).toBe("first");
		writeFileSync(path, "second\n");
		expect(await readSecret(NAME)).toBe("first");
	});

	it("reads the file again after an explicit invalidation", async () => {
		const path = secretFile("first\n");
		process.env[FILE_VAR] = path;
		await readSecret(NAME);
		writeFileSync(path, "second\n");
		clearSecretCache();
		expect(await readSecret(NAME)).toBe("second");
	});

	it("does not reuse a value across paths", async () => {
		const first = secretFile("first\n");
		const other = join(dir, "other");
		writeFileSync(other, "other\n");
		process.env[FILE_VAR] = first;
		await readSecret(NAME);
		process.env[FILE_VAR] = other;
		expect(await readSecret(NAME)).toBe("other");
	});

	it("does not cache a failure", async () => {
		const path = join(dir, "late");
		process.env[FILE_VAR] = path;
		await expect(readSecret(NAME)).rejects.toThrow("cannot be read");
		writeFileSync(path, "ready\n");
		expect(await readSecret(NAME)).toBe("ready");
	});

	it("does not cache the plain variable", async () => {
		process.env[NAME] = "one";
		expect(await readSecret(NAME)).toBe("one");
		process.env[NAME] = "two";
		expect(await readSecret(NAME)).toBe("two");
	});
});
