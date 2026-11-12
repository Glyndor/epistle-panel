import { afterAll, describe, expect, it } from "bun:test";
import {
	mkdirSync,
	mkdtempSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { FileTooLargeError, readRegularFile } from ".";

const dir = mkdtempSync(join(tmpdir(), "read-file-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

function file(name: string, content: string | Buffer): string {
	const path = join(dir, name);
	writeFileSync(path, content);
	return path;
}

describe("readRegularFile", () => {
	it("returns the bytes of a regular file", async () => {
		const bytes = await readRegularFile(file("a", "hello"), 100);

		expect(bytes.toString("utf8")).toBe("hello");
	});

	it("accepts a file of exactly the cap and refuses one byte more", async () => {
		expect(
			(await readRegularFile(file("max", "x".repeat(10)), 10)).length,
		).toBe(10);
		await expect(
			readRegularFile(file("over", "x".repeat(11)), 10),
		).rejects.toBeInstanceOf(FileTooLargeError);
	});

	it("refuses a symlink, even to a regular file", async () => {
		const target = file("target", "secret");
		const link = join(dir, "link");
		symlinkSync(target, link);

		await expect(readRegularFile(link, 100)).rejects.toThrow();
	});

	it("refuses a directory and a missing path", async () => {
		const sub = join(dir, "sub");
		mkdirSync(sub);

		await expect(readRegularFile(sub, 100)).rejects.toThrow();
		await expect(readRegularFile(join(dir, "nope"), 100)).rejects.toThrow();
	});

	it("reads an empty file as zero bytes", async () => {
		expect((await readRegularFile(file("empty", ""), 10)).length).toBe(0);
	});
});
