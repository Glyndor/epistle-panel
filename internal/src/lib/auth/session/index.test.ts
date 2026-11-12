import {
	afterEach,
	describe,
	expect,
	it,
	setSystemTime,
	spyOn,
} from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { clearRevocations } from "../revocation";

import {
	createSession,
	revokeSession,
	SESSION_COOKIE,
	SESSION_COOKIE_OPTIONS,
	SESSION_MAX_AGE_SECONDS,
	verifySession,
} from ".";

afterEach(() => {
	delete process.env.EPISTLE_PANEL_SESSION_SECRET_FILE;
	setSystemTime();
	clearRevocations();
});

function b64url(bytes: Uint8Array): string {
	return btoa(String.fromCharCode(...bytes))
		.replaceAll("+", "-")
		.replaceAll("/", "_")
		.replaceAll("=", "");
}

/** Sign an arbitrary payload object with the test secret, like the minter does. */
async function signRaw(payload: unknown): Promise<string> {
	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(
			process.env.EPISTLE_PANEL_SESSION_SECRET as string,
		),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const encoded = b64url(new TextEncoder().encode(JSON.stringify(payload)));
	const signature = await crypto.subtle.sign(
		"HMAC",
		key,
		new TextEncoder().encode(encoded),
	);
	return `${encoded}.${b64url(new Uint8Array(signature))}`;
}

const nowSeconds = () => Math.floor(Date.now() / 1000);

describe("session cookie", () => {
	it("uses the __Host- prefix and attributes that prefix requires", () => {
		expect(SESSION_COOKIE.startsWith("__Host-")).toBe(true);
		expect(SESSION_COOKIE_OPTIONS).toMatchObject({
			secure: true,
			path: "/",
			httpOnly: true,
			sameSite: "lax",
			maxAge: SESSION_MAX_AGE_SECONDS,
		});
		expect(SESSION_COOKIE_OPTIONS).not.toHaveProperty("domain");
	});
});

describe("token shape", () => {
	it("rejects a token with extra segments", async () => {
		const token = await createSession("ops");
		expect(await verifySession(`${token}.extra`)).toBeNull();
		expect(await verifySession(`${token}.a.b`)).toBeNull();
	});

	it("rejects a signature that is not exactly 32 bytes before verifying it", async () => {
		const token = await createSession("ops");
		const [payload, signature] = token.split(".") as [string, string];
		const verify = spyOn(crypto.subtle, "verify");
		try {
			expect(
				await verifySession(`${payload}.${signature.slice(0, -4)}`),
			).toBeNull();
			expect(
				await verifySession(`${payload}.${signature}AAAA`),
			).toBeNull();
			// A wrong-length value cannot be a valid HMAC, so this is a shape check
			// that must stop the token before any signature work.
			expect(verify).not.toHaveBeenCalled();
		} finally {
			verify.mockRestore();
		}
	});

	it("rejects a signature written non-canonically", async () => {
		const token = await createSession("ops");
		const [payload, signature] = token.split(".") as [string, string];
		// The last character carries two spare bits: another letter with the
		// same value bits decodes to the same 32 bytes but is a different string.
		const alphabet =
			"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
		const last = alphabet.indexOf(signature.at(-1) as string);
		const sibling = alphabet[last ^ 1] as string;
		expect(
			await verifySession(
				`${payload}.${signature.slice(0, -1)}${sibling}`,
			),
		).toBeNull();
	});
});

describe("token lifetime", () => {
	it("accepts a correctly signed token with an in-range exp", async () => {
		const token = await signRaw({ sub: "ops", exp: nowSeconds() + 60 });
		expect(await verifySession(token)).toEqual({ sub: "ops" });
	});

	it("rejects a non-finite exp", async () => {
		// JSON.stringify(Infinity) is "null", so write the number by hand.
		const key = await crypto.subtle.importKey(
			"raw",
			new TextEncoder().encode(
				process.env.EPISTLE_PANEL_SESSION_SECRET as string,
			),
			{ name: "HMAC", hash: "SHA-256" },
			false,
			["sign"],
		);
		const encoded = b64url(
			new TextEncoder().encode('{"sub":"ops","exp":1e999}'),
		);
		const signature = await crypto.subtle.sign(
			"HMAC",
			key,
			new TextEncoder().encode(encoded),
		);
		const token = `${encoded}.${b64url(new Uint8Array(signature))}`;
		expect(await verifySession(token)).toBeNull();
	});

	it("rejects a fractional exp", async () => {
		const token = await signRaw({ sub: "ops", exp: nowSeconds() + 60.5 });
		expect(await verifySession(token)).toBeNull();
	});

	it("rejects an exp beyond the maximum lifetime", async () => {
		const token = await signRaw({
			sub: "ops",
			exp: nowSeconds() + SESSION_MAX_AGE_SECONDS + 5,
		});
		expect(await verifySession(token)).toBeNull();
	});
});

describe("session lifetime, in literals", () => {
	// These numbers are written out on purpose: a test that reads the limit from
	// the module it checks agrees with whatever the module says.
	const EIGHT_HOURS = 28_800;
	const NOW = new Date("2026-03-01T12:00:00Z");
	const now = () => Math.floor(NOW.getTime() / 1000);

	it("is eight hours, for the token and for the cookie", () => {
		expect(SESSION_MAX_AGE_SECONDS).toBe(EIGHT_HOURS);
		expect(SESSION_COOKIE_OPTIONS.maxAge).toBe(EIGHT_HOURS);
	});

	it("mints a token that expires exactly eight hours from now", async () => {
		setSystemTime(NOW);
		const token = await createSession("ops");

		const payload = JSON.parse(
			atob(
				(token.split(".")[0] as string)
					.replaceAll("-", "+")
					.replaceAll("_", "/"),
			),
		) as { exp: number };
		expect(payload.exp).toBe(now() + EIGHT_HOURS);
	});

	it("accepts an exp eight hours out and refuses one second more", async () => {
		setSystemTime(NOW);

		expect(
			await verifySession(
				await signRaw({ sub: "ops", exp: now() + EIGHT_HOURS }),
			),
		).toEqual({ sub: "ops" });
		expect(
			await verifySession(
				await signRaw({ sub: "ops", exp: now() + EIGHT_HOURS + 1 }),
			),
		).toBeNull();
	});

	it("stops accepting a token the second its exp is reached", async () => {
		setSystemTime(NOW);
		const token = await signRaw({ sub: "ops", exp: now() + 10 });

		setSystemTime(new Date(NOW.getTime() + 9_000));
		expect(await verifySession(token)).toEqual({ sub: "ops" });
		setSystemTime(new Date(NOW.getTime() + 10_000));
		expect(await verifySession(token)).toBeNull();
	});
});

describe("revocation", () => {
	it("makes a revoked token stop verifying", async () => {
		const token = await createSession("ops");
		expect(await verifySession(token)).toEqual({ sub: "ops" });

		await revokeSession(token);

		expect(await verifySession(token)).toBeNull();
	});

	it("leaves other sessions of the same account alone", async () => {
		const revoked = await createSession("ops");
		const other = await createSession("ops");

		await revokeSession(revoked);

		expect(await verifySession(other)).toEqual({ sub: "ops" });
	});

	it("ignores an invalid token and an absent one", async () => {
		await revokeSession("forged.token");
		await revokeSession(undefined);
		expect(await verifySession(await createSession("ops"))).toEqual({
			sub: "ops",
		});
	});
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
