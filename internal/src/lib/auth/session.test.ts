import { afterEach, describe, expect, it, setSystemTime } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
	createSession,
	SESSION_MAX_AGE_SECONDS,
	verifySession,
} from "./session";

afterEach(() => {
	delete process.env.EPISTLE_PANEL_SESSION_SECRET_FILE;
	setSystemTime();
});

describe("session tokens", () => {
	it("verifies a token it just minted", async () => {
		const token = await createSession("ops");
		expect(await verifySession(token)).toEqual({ sub: "ops" });
	});

	it("rejects a missing or malformed token", async () => {
		expect(await verifySession(undefined)).toBeNull();
		expect(await verifySession("")).toBeNull();
		expect(await verifySession("no-dot")).toBeNull();
		expect(await verifySession("a.b")).toBeNull();
	});

	it("rejects a tampered signature", async () => {
		const token = await createSession("ops");
		expect(await verifySession(`${token}tampered`)).toBeNull();
	});

	it("rejects a swapped payload under a stolen signature", async () => {
		const token = await createSession("ops");
		const signature = token.split(".")[1];
		const forgedPayload = btoa('{"sub":"evil","exp":9999999999}')
			.replaceAll("+", "-")
			.replaceAll("/", "_")
			.replaceAll("=", "");
		expect(await verifySession(`${forgedPayload}.${signature}`)).toBeNull();
	});

	it("rejects an expired token", async () => {
		const token = await createSession("ops");
		setSystemTime(
			new Date(Date.now() + (SESSION_MAX_AGE_SECONDS + 60) * 1000),
		);
		expect(await verifySession(token)).toBeNull();
	});
});

describe("session secret file", () => {
	let dir: string | undefined;

	afterEach(() => {
		if (dir) {
			rmSync(dir, { recursive: true });
			dir = undefined;
		}
	});

	function writeSecretFile(content: string): void {
		dir = mkdtempSync(join(tmpdir(), "epistle-session-"));
		const path = join(dir, "secret");
		writeFileSync(path, content);
		process.env.EPISTLE_PANEL_SESSION_SECRET_FILE = path;
	}

	it("signs with the file secret instead of the plain one", async () => {
		const plain = await createSession("ops");
		writeSecretFile("another-secret-from-a-file-32-bytes-long\n");
		const fromFile = await createSession("ops");
		expect(await verifySession(fromFile)).toEqual({ sub: "ops" });
		expect(await verifySession(plain)).toBeNull();
	});

	it("locks every session when the secret file is unusable", async () => {
		const token = await createSession("ops");
		writeSecretFile("");
		expect(await verifySession(token)).toBeNull();
		expect(createSession("ops")).rejects.toThrow(
			"EPISTLE_PANEL_SESSION_SECRET_FILE",
		);
	});

	it("locks every session when no secret is configured", async () => {
		const saved = process.env.EPISTLE_PANEL_SESSION_SECRET;
		delete process.env.EPISTLE_PANEL_SESSION_SECRET;
		try {
			expect(await verifySession("a.b")).toBeNull();
			expect(createSession("ops")).rejects.toThrow(
				"EPISTLE_PANEL_SESSION_SECRET is not configured",
			);
		} finally {
			process.env.EPISTLE_PANEL_SESSION_SECRET = saved;
		}
	});
});
