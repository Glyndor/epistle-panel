import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { readSecret } from ".";

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
		await expect(readSecret(NAME)).rejects.toThrow("cannot be read");
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
