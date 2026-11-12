import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { execFileSync } from "node:child_process";
import {
	mkdirSync,
	mkdtempSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { type Rng, runCases } from "@/test/prng";

import { ConfigError } from "../config-error";
import { clearSecretCache, MAX_SECRET_BYTES, readSecret } from ".";

const NAME = "EPISTLE_GENERATED_SECRET";
const FILE_VAR = `${NAME}_FILE`;
const ALLOWED = "allowed-secret-value";
const PLAIN = "weaker-plain-value";

let dir: string;

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "epistle-secret-gen-"));
	// The only file a path may legitimately reach, and a plain variable that
	// must never stand in for an unusable file.
	writeFileSync(join(dir, "allowed"), `${ALLOWED}\n`);
	process.env[NAME] = PLAIN;
});

afterEach(() => {
	clearSecretCache();
	delete process.env[NAME];
	delete process.env[FILE_VAR];
	rmSync(dir, { recursive: true, force: true });
});

/** Point the `_FILE` variable at `path` and read, returning the value or the error. */
async function read(path: string): Promise<string | ConfigError | undefined> {
	clearSecretCache();
	process.env[FILE_VAR] = path;
	try {
		return await readSecret(NAME);
	} catch (error) {
		if (error instanceof ConfigError) {
			return error;
		}
		throw new Error(`threw ${String(error)} for a path that is not shown`);
	}
}

/**
 * Assert a refusal whose whole message is the variable name and the reason,
 * so it carries neither the path nor any content.
 */
function expectRefusal(
	result: string | ConfigError | undefined,
	reason: string,
): void {
	expect(result).toBeInstanceOf(ConfigError);
	const message = (result as ConfigError).message;
	expect(message).toBe(`${FILE_VAR} is set but ${reason}`);
}

function relativePath(rng: Rng): string {
	return rng.pick([
		"allowed",
		"./allowed",
		"../allowed",
		"a/../allowed",
		" ",
		"",
		".",
		"..",
		"~/allowed",
		"$HOME/allowed",
		"file:///etc/hostname",
		`x${rng.string("abc./", rng.int(0, 30))}`,
		"\u0000",
		"allowed\u0000",
	]);
}

describe("readSecret on generated paths", () => {
	it("refuses relative, empty and odd paths without reading anything", async () => {
		await runCases("relative paths", 600, async (rng) => {
			const path = relativePath(rng);
			expectRefusal(await read(path), "is not an absolute path");
		});
	});

	it("refuses absolute paths that are not one regular file, with the unreadable message", async () => {
		mkdirSync(join(dir, "folder"));
		symlinkSync(join(dir, "allowed"), join(dir, "link"));
		symlinkSync(dir, join(dir, "dirlink"));
		symlinkSync(join(dir, "missing"), join(dir, "dangling"));
		execFileSync("mkfifo", [join(dir, "pipe")]);
		const longName = "n".repeat(300);
		const bad = [
			join(dir, "folder"),
			join(dir, "link"),
			join(dir, "dangling"),
			join(dir, "pipe"),
			join(dir, "missing"),
			join(dir, "allowed", "x"),
			join(dir, "folder", "..", "missing"),
			join(dir, longName),
			join(dir, "a/".repeat(2000)),
			`${join(dir, "allowed")}\u0000.txt`,
			`${join(dir, "allowed")}\u0000`,
			"/dev/zero",
			"/dev/null",
			"/",
			dir,
			"/proc",
		];
		await runCases("unusable absolute paths", 400, async (rng) => {
			const base = rng.pick(bad);
			// Trailing slashes and doubled separators do not turn a link into a file.
			const path = rng.pick([
				base,
				base,
				`${base}/`,
				base.replace("/", "//"),
			]);
			const result = await read(path);
			if (path === join(dir, "allowed")) {
				return;
			}
			expect(result).toBeInstanceOf(ConfigError);
			expectRefusal(result, "the file cannot be read");
		});
	});

	it("reads the allowed file through dot segments and doubled separators", async () => {
		const target = join(dir, "allowed");
		await runCases("accepted spellings", 200, async (rng) => {
			const path = rng.pick([
				target,
				join(dir, ".", "allowed"),
				join(dir, "x", "..", "allowed"),
				target.replace(/\//g, "//"),
				`${dir}/${"./".repeat(rng.int(1, 40))}allowed`,
			]);
			mkdirSync(join(dir, "x"), { recursive: true });
			expect(await read(path)).toBe(ALLOWED);
		});
	});

	it("never falls back to the plain variable when the file is unusable", async () => {
		expect(await readSecret("EPISTLE_GENERATED_UNSET")).toBeUndefined();
		await read(join(dir, "missing"));
		expect(await read(join(dir, "missing"))).toBeInstanceOf(ConfigError);
		expect(process.env[NAME]).toBe(PLAIN);
	});
});

/** Reference for what a file of `bytes` reads as: decode, then drop trailing whitespace. */
function expected(bytes: Uint8Array): string {
	return new TextDecoder().decode(bytes).replace(/[\s﻿]+$/u, "");
}

const TRAILING = [
	"",
	"\n",
	"\r\n",
	"\n\n\n",
	" ",
	"\t \t",
	" \n \r\n ",
	" ",
	"  ",
	"﻿",
	"\v\f",
];
const BODY = [
	"s3cret",
	"a b",
	"line1\nline2",
	"  lead",
	"\tlead",
	"éü",
	"\u{1f600}",
	"x y",
	"-----BEGIN KEY-----\nabc\n-----END KEY-----",
];

describe("readSecret on generated contents", () => {
	it("trims only trailing whitespace and keeps the rest byte for byte", async () => {
		await runCases("whitespace patterns", 800, async (rng) => {
			const body = Buffer.from(
				rng.pick(BODY) + (rng.chance(0.3) ? rng.pick(BODY) : ""),
			);
			const trailing = Buffer.from(rng.pick(TRAILING));
			const content = Buffer.concat([body, trailing]);
			const path = join(dir, `s-${rng.int(0, 1e9)}`);
			writeFileSync(path, content);
			const want = expected(content);
			const got = await read(path);
			if (want === "") {
				expectRefusal(got, "the file is empty");
			} else {
				expect(got).toBe(want);
			}
		});
	});

	it("handles invalid UTF-8 as replacement characters and never throws", async () => {
		await runCases("invalid utf-8", 500, async (rng) => {
			const content = Buffer.concat([
				Buffer.from("k"),
				rng.bytes(rng.int(0, 200)),
				Buffer.from("e"),
			]);
			const path = join(dir, `b-${rng.int(0, 1e9)}`);
			writeFileSync(path, content);
			const got = await read(path);
			expect(got).toBe(expected(content));
		});
	});

	it("accepts files up to the cap and refuses one byte more, whatever they hold", async () => {
		await runCases("sizes around the cap", 40, async (rng) => {
			const delta = rng.pick([
				-65536,
				-2,
				-1,
				0,
				1,
				2,
				1000,
				MAX_SECRET_BYTES,
			]);
			const size = Math.max(1, MAX_SECRET_BYTES + delta);
			const filler = rng.pick(["a", "é", "7", "\n", " "]);
			// A repeated multi-byte filler is cut to the exact byte length.
			const content = Buffer.from(filler.repeat(size)).subarray(0, size);
			const path = join(dir, `c-${rng.int(0, 1e9)}`);
			writeFileSync(path, content);
			const got = await read(path);
			if (size > MAX_SECRET_BYTES) {
				expectRefusal(got, "the file is too large");
			} else if (expected(content) === "") {
				expectRefusal(got, "the file is empty");
			} else {
				expect(got).toBe(expected(content));
			}
		});
	});
});
