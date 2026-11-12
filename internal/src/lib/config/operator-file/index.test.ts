import { afterAll, afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { ConfigError } from "../config-error";
import { isOperatorFileConfigured, readOperatorFile } from ".";

const VAR = "EPISTLE_TEST_OPERATOR_FILE";
const dir = mkdtempSync(join(tmpdir(), "operator-file-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));
afterEach(() => {
	delete process.env[VAR];
});

describe("readOperatorFile", () => {
	it("is undefined when the variable is unset or empty", async () => {
		expect(await readOperatorFile(VAR, 100)).toBeUndefined();
		process.env[VAR] = "";
		expect(await readOperatorFile(VAR, 100)).toBeUndefined();
	});

	it("reads the file the variable names, afresh each time", async () => {
		const path = join(dir, "a.css");
		process.env[VAR] = path;
		writeFileSync(path, "one");
		expect((await readOperatorFile(VAR, 100))?.toString()).toBe("one");

		writeFileSync(path, "two");
		expect((await readOperatorFile(VAR, 100))?.toString()).toBe("two");
	});

	it("refuses a relative path, without echoing it", async () => {
		process.env[VAR] = "relative/theme.css";

		const error = await readOperatorFile(VAR, 100).catch((e) => e);

		expect(error).toBeInstanceOf(ConfigError);
		expect(error.message).toContain(VAR);
		expect(error.message).not.toContain("relative/theme.css");
	});

	it("refuses a symlink, a missing file and an oversized file with the variable's name only", async () => {
		const real = join(dir, "real.css");
		writeFileSync(real, "x".repeat(20));
		const link = join(dir, "link.css");
		symlinkSync(real, link);

		for (const path of [link, join(dir, "missing.css"), real]) {
			process.env[VAR] = path;
			const error = await readOperatorFile(VAR, 10).catch((e) => e);
			expect(error).toBeInstanceOf(ConfigError);
			expect(error.message).toContain(VAR);
			expect(error.message).not.toContain(dir);
		}
	});
});

describe("isOperatorFileConfigured", () => {
	it("is true only for a non-empty value", () => {
		expect(isOperatorFileConfigured(VAR)).toBe(false);
		process.env[VAR] = "";
		expect(isOperatorFileConfigured(VAR)).toBe(false);
		process.env[VAR] = "/x";
		expect(isOperatorFileConfigured(VAR)).toBe(true);
	});
});
