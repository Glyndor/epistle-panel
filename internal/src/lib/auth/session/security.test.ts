import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	setSystemTime,
	spyOn,
} from "bun:test";

import { clearRevocations } from "../revocation";
import { checkSession, createSession, revokeSession, verifySession } from ".";

const START = 1_800_000_000;
const USER = "EPISTLE_PANEL_SESSION_USER_MAX_AGE_MINUTES";
const ADMIN = "EPISTLE_PANEL_SESSION_ADMIN_MAX_AGE_MINUTES";
const IDLE = "EPISTLE_PANEL_SESSION_IDLE_TIMEOUT_MINUTES";
const SECRET = "EPISTLE_PANEL_SESSION_SECRET";
const savedSecret = process.env[SECRET];

beforeEach(() => setSystemTime(new Date(START * 1000)));
afterEach(() => {
	for (const name of [USER, ADMIN, IDLE]) delete process.env[name];
	process.env[SECRET] = savedSecret;
	clearRevocations();
	setSystemTime();
});

function claims(token: string): Record<string, unknown> {
	return JSON.parse(
		atob(
			(token.split(".")[0] as string)
				.replaceAll("-", "+")
				.replaceAll("_", "/"),
		),
	);
}
function encode(bytes: Uint8Array): string {
	return Buffer.from(bytes).toString("base64url");
}
async function signed(payload: unknown): Promise<string> {
	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(process.env[SECRET]),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const body = encode(new TextEncoder().encode(JSON.stringify(payload)));
	const mac = await crypto.subtle.sign(
		"HMAC",
		key,
		new TextEncoder().encode(body),
	);
	return `${body}.${encode(new Uint8Array(mac))}`;
}

describe("security regressions", () => {
	it("rejects legacy tokens and every missing or malformed identity/time claim", async () => {
		const base = claims(await createSession("ana", "user"));
		const cases: Record<string, unknown[]> = {
			jti: [
				undefined,
				null,
				"",
				"x",
				" ",
				1,
				[],
				{},
				"A".repeat(23),
				`${"A".repeat(21)}B`,
			],
			iat: [
				undefined,
				null,
				"1800000000",
				0,
				-1,
				START + 1,
				START - 28_801,
				START + 0.5,
				Number.MAX_SAFE_INTEGER,
			],
			exp: [
				undefined,
				null,
				"1800000060",
				0,
				-1,
				START,
				START + 28_801,
				START + 0.5,
				Number.MAX_SAFE_INTEGER,
			],
			role: [undefined, null, "", "Admin", "admin ", 1, [], {}],
			act: [
				null,
				"1800000000",
				-1,
				START + 1,
				START - 1,
				START + 0.5,
				[],
				{},
			],
		};
		for (const [field, values] of Object.entries(cases)) {
			for (const value of values) {
				const token = await signed({ ...base, [field]: value });
				expect(
					await verifySession(token),
					`${field}: ${JSON.stringify(value)}`,
				).toBeNull();
				expect(await checkSession(token)).toBeNull();
			}
		}
	});

	it("binds total lifetime to each role even after waiting following a policy reduction", async () => {
		for (const [role, variable] of [
			["user", USER],
			["admin", ADMIN],
		] as const) {
			process.env[variable] = "60";
			const token = await createSession("same-account", role);
			process.env[variable] = "10";
			setSystemTime(new Date((START + 3_100) * 1000));
			expect(await verifySession(token)).toBeNull();
			expect(await checkSession(token)).toBeNull();
			setSystemTime(new Date(START * 1000));
			delete process.env[variable];
		}
	});

	it("never extends exp, iat, jti or role through repeated refresh or policy increases", async () => {
		process.env[IDLE] = "2";
		for (const role of ["user", "admin"] as const) {
			process.env[role === "user" ? USER : ADMIN] = "3";
			let token = await createSession("same-account", role);
			const original = claims(token);
			process.env[role === "user" ? USER : ADMIN] = "60";
			for (const offset of [59, 118, 179]) {
				setSystemTime(new Date((START + offset) * 1000));
				const checked = await checkSession(token);
				expect(checked?.expiresIn).toBe(180 - offset);
				token = checked?.refreshed ?? "";
				expect(claims(token)).toEqual({
					...original,
					act: START + offset,
				});
			}
			setSystemTime(new Date((START + 180) * 1000));
			expect(await verifySession(token)).toBeNull();
			setSystemTime(new Date(START * 1000));
		}
	});

	it("revokes all refreshed copies using an idle older copy even with an unreadable policy", async () => {
		for (const invalidPolicy of [false, true]) {
			process.env[IDLE] = "2";
			const first = await createSession("ana", "user");
			setSystemTime(new Date((START + 100) * 1000));
			const second = (await checkSession(first))?.refreshed;
			expect(second).toBeTruthy();
			setSystemTime(new Date((START + 121) * 1000));
			expect(await verifySession(first)).toBeNull();
			expect(await verifySession(second ?? undefined)).not.toBeNull();
			if (invalidPolicy) process.env[IDLE] = "broken";
			await revokeSession(first);
			process.env[IDLE] = "2";
			expect(await verifySession(second ?? undefined)).toBeNull();
			setSystemTime(new Date(START * 1000));
		}
	});

	it("fails closed for every invalid policy variable and for a removed signing secret", async () => {
		const token = await createSession("ops", "admin");
		for (const name of [USER, ADMIN, IDLE]) {
			process.env[name] = "broken";
			expect(await verifySession(token)).toBeNull();
			expect(await checkSession(token)).toBeNull();
			delete process.env[name];
		}
		delete process.env[SECRET];
		expect(await verifySession(token)).toBeNull();
		expect(await checkSession(token)).toBeNull();
	});

	it("uses Web Crypto verification and rejects a same-length forged signature", async () => {
		const token = await createSession("ana", "user");
		const verify = spyOn(crypto.subtle, "verify");
		try {
			const [body, signature] = token.split(".") as [string, string];
			const forged = `${body}.${signature[0] === "A" ? "B" : "A"}${signature.slice(1)}`;
			expect(await verifySession(forged)).toBeNull();
			expect(verify).toHaveBeenCalledTimes(1);
			expect(verify.mock.calls[0]?.[0]).toBe("HMAC");
			expect(await verifySession(token)).toEqual({
				sub: "ana",
				role: "user",
			});
		} finally {
			verify.mockRestore();
		}
	});

	it("returns no session if signing fails or absolute expiry passes during verification", async () => {
		process.env[IDLE] = "1";
		process.env[USER] = "1";
		const token = await createSession("ana", "user");
		const sign = spyOn(crypto.subtle, "sign").mockRejectedValue(
			new Error("unavailable"),
		);
		try {
			expect(await checkSession(token)).toBeNull();
		} finally {
			sign.mockRestore();
		}
		const verify = spyOn(crypto.subtle, "verify").mockImplementation(
			async () => {
				setSystemTime(new Date((START + 60) * 1000));
				return true;
			},
		);
		try {
			expect(await checkSession(token)).toBeNull();
		} finally {
			verify.mockRestore();
		}
	});
});
