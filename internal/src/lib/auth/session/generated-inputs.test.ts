import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	setSystemTime,
} from "bun:test";

import { type createRng, runCases } from "@/test/prng";

import { clearRevocations } from "../revocation";

import { createSession, SESSION_MAX_AGE_SECONDS, verifySession } from ".";

const B64URL =
	"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const NOW_MS = Date.UTC(2026, 10, 12, 12, 0, 0);
const NOW_S = NOW_MS / 1000;

beforeEach(() => {
	setSystemTime(new Date(NOW_MS));
});

afterEach(() => {
	setSystemTime();
	clearRevocations();
});

function b64url(bytes: Uint8Array): string {
	return btoa(String.fromCharCode(...bytes))
		.replaceAll("+", "-")
		.replaceAll("/", "_")
		.replaceAll("=", "");
}

/** Sign `json` verbatim with the test secret, like the minter does. */
async function signJson(json: string): Promise<string> {
	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(
			process.env.EPISTLE_PANEL_SESSION_SECRET as string,
		),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const encoded = b64url(new TextEncoder().encode(json));
	const signature = await crypto.subtle.sign(
		"HMAC",
		key,
		new TextEncoder().encode(encoded),
	);
	return `${encoded}.${b64url(new Uint8Array(signature))}`;
}

/** Assert `token` is refused and that the call neither throws nor hangs. */
async function expectRefused(token: string | undefined): Promise<void> {
	expect(await verifySession(token)).toBeNull();
}

describe("verifySession on generated tokens", () => {
	it("refuses every single-character mutation of a valid token", async () => {
		const valid = await createSession("admin");
		expect(await verifySession(valid)).toEqual({ sub: "admin" });
		await runCases(
			"single-character flips",
			valid.length,
			async (rng, i) => {
				// Case i flips position i, so every position is covered once per run.
				const original = valid[i] as string;
				const alphabet = `${B64URL}.=+/ %\u0000é😀`;
				let replacement = rng.pick(Array.from(alphabet));
				if (replacement === original) {
					replacement = original === "A" ? "B" : "A";
				}
				await expectRefused(
					valid.slice(0, i) + replacement + valid.slice(i + 1),
				);
			},
		);
	});

	it("refuses every other character at the last position of each half", async () => {
		// The final character of a base64url half carries spare bits: several
		// characters decode to the same bytes, and only one is canonical.
		const valid = await createSession("admin");
		const dot = valid.indexOf(".");
		for (const position of [dot - 1, valid.length - 1]) {
			for (const char of B64URL) {
				if (char === valid[position]) {
					continue;
				}
				await expectRefused(
					valid.slice(0, position) + char + valid.slice(position + 1),
				);
			}
		}
	});

	it("refuses truncations, extensions and extra dots of a valid token", async () => {
		const valid = await createSession("admin");
		for (let cut = 0; cut < valid.length; cut++) {
			await expectRefused(valid.slice(0, cut));
		}
		await runCases("extensions", 400, async (rng) => {
			const extra = rng.string(`${B64URL}.=`, rng.int(1, 12));
			await expectRefused(valid + extra);
			await expectRefused(extra + valid);
			const at = rng.int(0, valid.length);
			await expectRefused(`${valid.slice(0, at)}.${valid.slice(at)}`);
		});
		await expectRefused(`${valid}.${valid}`);
		await expectRefused(valid.replace(".", ".."));
		await expectRefused(`.${valid}`);
		await expectRefused(`${valid}.`);
	});

	it("refuses random strings, random bytes and tokens in other alphabets", async () => {
		await runCases("random tokens", 1500, async (rng) => {
			const kind = rng.int(0, 4);
			let token: string;
			if (kind === 0) {
				token = rng.string(B64URL, rng.int(0, 200));
			} else if (kind === 1) {
				token = `${b64url(rng.bytes(rng.int(1, 120)))}.${b64url(rng.bytes(32))}`;
			} else if (kind === 2) {
				token = `${b64url(rng.bytes(rng.int(1, 120)))}.${b64url(rng.bytes(rng.int(0, 64)))}`;
			} else if (kind === 3) {
				token = rng.string("+/=. \u0000\né\u{1f600}‮", rng.int(1, 60));
			} else {
				token = String.fromCharCode(...rng.bytes(rng.int(1, 80)));
			}
			await expectRefused(token);
		});
		await expectRefused(undefined);
		await expectRefused("");
		await expectRefused("A".repeat(2_000_000));
		await expectRefused(
			`${"A".repeat(1_000_000)}.${"B".repeat(1_000_000)}`,
		);
	});
});

/** A payload value for `exp`, valid or not, with the reference verdict. */
function expValue(rng: ReturnType<typeof createRng>): {
	json: string;
	ok: boolean;
} {
	const delta = rng.int(1, SESSION_MAX_AGE_SECONDS);
	const choices: { json: string; ok: boolean }[] = [
		{ json: String(NOW_S + delta), ok: true },
		{ json: String(NOW_S + SESSION_MAX_AGE_SECONDS), ok: true },
		{ json: `${NOW_S + delta}.0`, ok: true },
		{
			json: String(NOW_S + SESSION_MAX_AGE_SECONDS + rng.int(1, 1e6)),
			ok: false,
		},
		{ json: String(NOW_S), ok: false },
		{ json: String(NOW_S - rng.int(1, 1e6)), ok: false },
		{ json: String(-rng.int(1, 1e9)), ok: false },
		{ json: "0", ok: false },
		{ json: `${NOW_S + delta}.5`, ok: false },
		{ json: `${NOW_S + delta}e0`, ok: true },
		{ json: "1e308", ok: false },
		{ json: "1e999", ok: false },
		{ json: "-1e999", ok: false },
		{ json: "9007199254740993", ok: false },
		{ json: "null", ok: false },
		{ json: "NaN", ok: false },
		{ json: `"${NOW_S + delta}"`, ok: false },
		{ json: '"NaN"', ok: false },
		{ json: "true", ok: false },
		{ json: "[]", ok: false },
		{ json: `[${NOW_S + delta}]`, ok: false },
		{ json: "{}", ok: false },
		{ json: `{"valueOf":${NOW_S + delta}}`, ok: false },
	];
	return rng.pick(choices);
}

function subValue(rng: ReturnType<typeof createRng>): {
	json: string;
	ok: boolean;
} {
	const name = rng.string("abcXYZ09-_. é😀", rng.int(0, 12));
	return rng.pick([
		{ json: JSON.stringify(name), ok: true },
		{ json: '""', ok: true },
		{ json: "1", ok: false },
		{ json: "null", ok: false },
		{ json: "true", ok: false },
		{ json: "[]", ok: false },
		{ json: '["admin"]', ok: false },
		{ json: '{"toString":"admin"}', ok: false },
	]);
}

describe("verifySession on signed but odd payloads", () => {
	it("accepts a payload only when sub is a string and exp a future integer in range", async () => {
		let accepted = 0;
		let refused = 0;
		await runCases("signed payloads", 1200, async (rng) => {
			const exp = expValue(rng);
			const sub = subValue(rng);
			const fields = [`"sub":${sub.json}`, `"exp":${exp.json}`];
			if (rng.chance(0.3)) {
				fields.push(`"jti":${rng.pick(['"x"', "1", "null", "[]"])}`);
			}
			if (rng.chance(0.3)) {
				fields.push(
					`"${rng.pick(["extra", "__proto__", "constructor"])}":{"a":1}`,
				);
			}
			// Field order does not matter to a JSON object.
			for (let i = fields.length - 1; i > 0; i--) {
				const j = rng.int(0, i);
				[fields[i], fields[j]] = [
					fields[j] as string,
					fields[i] as string,
				];
			}
			const token = await signJson(`{${fields.join(",")}}`);
			const result = await verifySession(token);
			if (exp.ok && sub.ok) {
				accepted++;
				expect(result).toEqual({ sub: JSON.parse(sub.json) });
			} else {
				refused++;
				expect(result).toBeNull();
			}
		});
		// Both branches must have run, or the model is vacuous.
		expect(accepted).toBeGreaterThan(20);
		expect(refused).toBeGreaterThan(20);
	});

	it("takes the last of duplicate keys, as JSON does, and still checks it", async () => {
		const future = NOW_S + 60;
		const good = await signJson(`{"sub":"x","sub":"y","exp":${future}}`);
		expect(await verifySession(good)).toEqual({ sub: "y" });
		const badLast = await signJson(
			`{"sub":"x","exp":${future},"exp":${NOW_S - 1}}`,
		);
		expect(await verifySession(badLast)).toBeNull();
		const typeLast = await signJson(`{"sub":"x","sub":7,"exp":${future}}`);
		expect(await verifySession(typeLast)).toBeNull();
	});

	it("refuses payloads that are not objects, however they are shaped", async () => {
		const deep = (open: string, close: string, depth: number) =>
			open.repeat(depth) + close.repeat(depth);
		const jsons = [
			"",
			"null",
			"1",
			'"admin"',
			"[]",
			"[1,2]",
			"{",
			"{}",
			'{"sub":"a"}',
			`{"exp":${NOW_S + 60}}`,
			`{"sub":${deep("[", "]", 5000)},"exp":${NOW_S + 60}}`,
			deep("[", "]", 100_000),
			deep('{"a":', "}", 20_000).replace(/\{"a":\}/, "{}"),
			'{"__proto__":{"sub":"a","exp":1}}',
			`{"constructor":{"prototype":{"sub":"a"}},"exp":${NOW_S + 60}}`,
		];
		for (const json of jsons) {
			await expectRefused(await signJson(json));
		}
		// Depth in an unread field is harmless: the signed payload still verifies.
		const nested = await signJson(
			`{"sub":"a","exp":${NOW_S + 60},"deep":${deep("[", "]", 5000)}}`,
		);
		expect(await verifySession(nested)).toEqual({ sub: "a" });
		expect(({} as { sub?: string }).sub).toBeUndefined();
	});
});
