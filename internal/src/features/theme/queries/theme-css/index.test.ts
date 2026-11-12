import { afterAll, afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { ConfigError } from "@/lib/config/config-error";

import {
	isThemeConfigured,
	MAX_THEME_BYTES,
	readThemeCss,
	THEME_CSS_VARIABLE,
} from ".";

const dir = mkdtempSync(join(tmpdir(), "theme-css-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));
afterEach(() => {
	delete process.env[THEME_CSS_VARIABLE];
});

function use(content: string | Buffer): void {
	const path = join(dir, `t-${Math.random()}.css`);
	writeFileSync(path, content);
	process.env[THEME_CSS_VARIABLE] = path;
}

describe("readThemeCss", () => {
	it("is undefined, and not configured, without the variable", async () => {
		expect(isThemeConfigured()).toBe(false);
		expect(await readThemeCss()).toBeUndefined();
	});

	it("returns the stylesheet as text", async () => {
		use(":root { --primary: red; }");

		expect(isThemeConfigured()).toBe(true);
		expect(await readThemeCss()).toBe(":root { --primary: red; }");
	});

	it("accepts a file of exactly the cap and refuses one byte more", async () => {
		use("a".repeat(MAX_THEME_BYTES));
		expect((await readThemeCss())?.length).toBe(MAX_THEME_BYTES);

		use("a".repeat(MAX_THEME_BYTES + 1));
		await expect(readThemeCss()).rejects.toBeInstanceOf(ConfigError);
	});

	it("refuses a file that is not UTF-8 text or holds a NUL byte", async () => {
		use(Buffer.from([0xff, 0xfe, 0x00, 0x41]));
		await expect(readThemeCss()).rejects.toThrow("not text");

		use("a\0b");
		await expect(readThemeCss()).rejects.toThrow("not text");
	});

	it("refuses an unreadable file with the variable's name only", async () => {
		process.env[THEME_CSS_VARIABLE] = join(dir, "missing.css");

		const error = await readThemeCss().catch((e) => e);

		expect(error.message).toContain(THEME_CSS_VARIABLE);
		expect(error.message).not.toContain(dir);
	});
});
