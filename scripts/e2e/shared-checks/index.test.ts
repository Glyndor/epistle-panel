import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const scripts = join(import.meta.dir, "..");
const root = join(scripts, "..", "..");

/** Run the sourced shell function `call` with `file` as its first argument. */
function sh(call: string): string {
	const result = Bun.spawnSync(
		["sh", "-c", `. "${scripts}/html-checks.sh"; ${call}`],
		{ stdout: "pipe", stderr: "pipe" },
	);
	return result.stdout.toString().trim();
}

/** Count the script tags of `html` that lack `nonce`, through the shell function. */
function unnonced(html: string, nonce = "abc123"): string {
	const dir = mkdtempSync(join(tmpdir(), "html-checks-"));
	try {
		const file = join(dir, "page.html");
		writeFileSync(file, html);
		return sh(`unnonced_scripts "${file}" "${nonce}"`);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
}

describe("session cookie name", () => {
	test("the scripts use the name the panel sets", () => {
		const shell = readFileSync(join(scripts, "session-cookie.sh"), "utf8");
		const source = readFileSync(
			join(root, "internal/src/lib/auth/session/index.ts"),
			"utf8",
		);
		const fromShell = /^SESSION_COOKIE_NAME="([^"]+)"$/m.exec(shell)?.[1];
		const fromSource = /SESSION_COOKIE = "([^"]+)"/.exec(source)?.[1];

		expect(fromShell).toBeDefined();
		expect(fromShell).toBe(fromSource);
	});

	test("run.sh and verify.sh read it from the shared file", () => {
		for (const script of ["e2e/run.sh", "headers/verify.sh"]) {
			const text = readFileSync(join(scripts, "..", script), "utf8");
			expect(text).toContain("session-cookie.sh");
			expect(text).not.toMatch(/epistle_admin_session/);
		}
	});
});

describe("unnonced_scripts", () => {
	test("counts nothing when every tag carries the nonce", () => {
		expect(
			unnonced(
				'<script src="/a.js" async="" nonce="abc123"></script><script nonce="abc123">x</script>',
			),
		).toBe("0");
	});

	test("counts a tag with attributes and no nonce", () => {
		expect(unnonced('<script src="/_next/static/x.js" async></script>')).toBe(
			"1",
		);
		expect(unnonced('<script type="module" src="/m.js"></script>')).toBe("1");
	});

	test("counts a bare tag, a wrong nonce, other case and a split tag", () => {
		expect(unnonced("<script>x</script>")).toBe("1");
		expect(unnonced('<script nonce="other">x</script>')).toBe("1");
		expect(unnonced('<SCRIPT SRC="/a.js"></SCRIPT>')).toBe("1");
		expect(unnonced('<script\n  src="/a.js"\n  async></script>')).toBe("1");
	});

	test("counts one un-nonced tag among nonced ones", () => {
		expect(
			unnonced(
				'<script nonce="abc123">a</script><script src="/b.js" async></script><script nonce="abc123">c</script>',
			),
		).toBe("1");
	});

	test("counts nothing for a page without scripts", () => {
		expect(unnonced("<html><body><p>hello</p></body></html>")).toBe("0");
	});
});

describe("CAPTCHA scenario constants", () => {
	test("the scenario's token and secret are the stand-in provider's", async () => {
		const shell = readFileSync(join(scripts, "scenarios", "captcha.sh"), "utf8");
		const standIn = await import("../stand-in-api");
		const token = /^CAPTCHA_SOLVED_TOKEN="([^"]+)"$/m.exec(shell)?.[1];
		const secret = /^CAPTCHA_SECRET="([^"]+)"$/m.exec(shell)?.[1];

		expect(token).toBe(standIn.CAPTCHA_SOLVED_TOKEN);
		expect(secret).toBe(standIn.CAPTCHA_SECRET);
	});

	test("the scenario names the input the stand-in widget writes", () => {
		const shell = readFileSync(join(scripts, "scenarios", "captcha.sh"), "utf8");

		expect(shell).toContain("EPISTLE_PANEL_CAPTCHA_RESPONSE_FIELD=stand-in-captcha-response");
	});
});
