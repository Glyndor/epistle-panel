import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ConfigError } from "../config-error";
import { clearSecretCache } from "../secret";
import { TEST_ADMIN_ID } from "../test-support/admin-id";

import { ADMIN_ID_VARIABLE, readAdminId, readAdminIdState } from ".";

let dir: string;

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "epistle-admin-id-"));
});

afterEach(() => {
	clearSecretCache();
	delete process.env[`${ADMIN_ID_VARIABLE}_FILE`];
	process.env[ADMIN_ID_VARIABLE] = TEST_ADMIN_ID;
	rmSync(dir, { recursive: true, force: true });
});

describe("readAdminIdState", () => {
	it("is enabled with the id when the variable holds a lower-case UUID v4", async () => {
		expect(await readAdminIdState()).toEqual({
			state: "enabled",
			id: TEST_ADMIN_ID,
		});
	});

	it("is disabled, the fail-closed default, when nothing is set or the value is empty", async () => {
		delete process.env[ADMIN_ID_VARIABLE];
		expect(await readAdminIdState()).toEqual({ state: "disabled" });
		process.env[ADMIN_ID_VARIABLE] = "";
		expect(await readAdminIdState()).toEqual({ state: "disabled" });
	});

	it("reads the id from a file, like the other secrets, and trims the newline", async () => {
		const path = join(dir, "admin-id");
		writeFileSync(path, `${TEST_ADMIN_ID}\n`);
		delete process.env[ADMIN_ID_VARIABLE];
		process.env[`${ADMIN_ID_VARIABLE}_FILE`] = path;

		expect(await readAdminIdState()).toEqual({
			state: "enabled",
			id: TEST_ADMIN_ID,
		});
	});

	it("throws a ConfigError that names the variable and never the value for a malformed id", async () => {
		for (const value of [
			"mail",
			TEST_ADMIN_ID.toUpperCase(),
			"6ba7b810-9dad-11d1-80b4-00c04fd430c8",
			"018f3a6e-7b2c-7c5a-9a3b-1c2d3e4f5a6b",
			` ${TEST_ADMIN_ID}`,
			`${TEST_ADMIN_ID}0`,
			"3f2b8c1e-5d4a-4b7e-9c3d-1a2b3c4d5e6g",
		]) {
			process.env[ADMIN_ID_VARIABLE] = value;
			const error = await readAdminIdState().catch((e) => e);
			expect(error, value).toBeInstanceOf(ConfigError);
			expect(error.message).toContain(ADMIN_ID_VARIABLE);
			expect(error.message).not.toContain(value.trim() || "\u0000");
		}
	});
});

describe("readAdminId", () => {
	it("returns the id when the area is on", async () => {
		expect(await readAdminId()).toBe(TEST_ADMIN_ID);
	});

	it("returns undefined when the area is off, and for a malformed id or a bad file, never any id", async () => {
		delete process.env[ADMIN_ID_VARIABLE];
		expect(await readAdminId()).toBeUndefined();
		process.env[ADMIN_ID_VARIABLE] = "not-a-uuid";
		expect(await readAdminId()).toBeUndefined();
		process.env[`${ADMIN_ID_VARIABLE}_FILE`] = join(dir, "missing");
		expect(await readAdminId()).toBeUndefined();
	});
});
