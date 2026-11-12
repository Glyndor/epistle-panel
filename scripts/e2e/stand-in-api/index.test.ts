import { afterAll, beforeEach, describe, expect, test } from "bun:test";

import {
	accountsSchema,
	apiErrorSchema,
	domainsSchema,
	queuePageSchema,
	removedSchema,
	statusSchema,
	verifyResultSchema,
} from "../../../internal/src/lib/api/schemas";
import {
	CAPTCHA_FIELD,
	CAPTCHA_SECRET,
	CAPTCHA_SOLVED_TOKEN,
	createStandIn,
	type LoggedRequest,
} from "./index";

const TOKEN = "stand-in-test-token";
const { server } = createStandIn({ token: TOKEN });
const base = `http://127.0.0.1:${server.port}`;

afterAll(() => server.stop(true));

beforeEach(async () => {
	await fetch(`${base}/__control/reset`, { method: "POST" });
});

const auth = { Authorization: `Bearer ${TOKEN}` };

async function verify(name: string, password: string) {
	const response = await fetch(`${base}/api/v1/auth/verify`, {
		method: "POST",
		headers: { ...auth, "Content-Type": "application/json" },
		body: JSON.stringify({ name, password }),
	});
	return verifyResultSchema.parse(await response.json());
}

async function logged(): Promise<LoggedRequest[]> {
	return (await fetch(`${base}/__control/log`)).json();
}

describe("responses match the panel's schemas", () => {
	test("status, domains and accounts", async () => {
		const get = async (path: string) =>
			(await fetch(`${base}${path}`, { headers: auth })).json();
		expect(statusSchema.parse(await get("/api/v1/status")).queue_size).toBe(5);
		expect(domainsSchema.parse(await get("/api/v1/domains")).domains).toEqual([
			"example.test",
		]);
		expect(accountsSchema.parse(await get("/api/v1/accounts")).accounts).toHaveLength(3);
	});

	test("queue pages by cursor until the last page has none", async () => {
		const seen: string[] = [];
		let cursor: string | undefined;
		for (let pages = 0; pages < 10; pages++) {
			const query = cursor ? `?cursor=${cursor}` : "";
			const page = queuePageSchema.parse(
				await (await fetch(`${base}/api/v1/queue${query}`, { headers: auth })).json(),
			);
			seen.push(...page.entries.map((entry) => entry.id));
			cursor = page.next_cursor;
			if (!cursor) {
				break;
			}
		}
		expect(seen).toHaveLength(5);
		expect(cursor).toBeUndefined();
	});

	test("removal drops the entry once and answers 404 the second time", async () => {
		const id = "11111111-1111-4111-8111-111111111111";
		const first = await fetch(`${base}/api/v1/queue/${id}`, {
			method: "DELETE",
			headers: auth,
		});
		expect(removedSchema.parse(await first.json()).removed).toBe(id);
		const second = await fetch(`${base}/api/v1/queue/${id}`, {
			method: "DELETE",
			headers: auth,
		});
		expect(second.status).toBe(404);
		expect(apiErrorSchema.parse(await second.json()).error.code).toBe("not_found");
	});
});

describe("sign-in", () => {
	test("accepts the admin, refuses a wrong password, flags a non-admin", async () => {
		expect(await verify("admin", "correct-horse")).toEqual({ valid: true, admin: true });
		expect(await verify("admin", "wrong")).toEqual({ valid: false, admin: false });
		expect(await verify("user", "plain-staple")).toEqual({ valid: true, admin: false });
		expect(await verify("nobody", "x")).toEqual({ valid: false, admin: false });
	});
});

describe("bearer token", () => {
	test("a missing or wrong token gets 401 and is logged as such", async () => {
		const none = await fetch(`${base}/api/v1/status`);
		const wrong = await fetch(`${base}/api/v1/status`, {
			headers: { Authorization: "Bearer nope" },
		});
		expect(none.status).toBe(401);
		expect(wrong.status).toBe(401);
		expect((await logged()).map((entry) => entry.bearer)).toEqual(["absent", "wrong"]);
	});
});

describe("log", () => {
	test("holds header names, the account name and no secret", async () => {
		await verify("admin", "correct-horse");
		const dump = JSON.stringify(await logged());
		expect(dump).toContain('"name":"admin"');
		expect(dump).toContain('"bearer":"valid"');
		expect(dump).toContain("authorization");
		expect(dump).not.toContain(TOKEN);
		expect(dump).not.toContain("correct-horse");
	});

	test("control paths are not logged", async () => {
		await logged();
		expect(await logged()).toEqual([]);
	});
});

describe("modes", () => {
	async function setMode(mode: string) {
		return fetch(`${base}/__control/mode`, {
			method: "POST",
			body: JSON.stringify({ mode }),
		});
	}

	test("hang never answers a data call but still answers sign-in", async () => {
		await setMode("hang");
		const pending = await Promise.race([
			fetch(`${base}/api/v1/status`, { headers: auth }).then(() => "answered"),
			new Promise((resolve) => setTimeout(() => resolve("silent"), 300)),
		]);
		expect(pending).toBe("silent");
		expect(await verify("admin", "correct-horse")).toEqual({ valid: true, admin: true });
	});

	test("huge streams more than the panel's cap with no content-length", async () => {
		await setMode("huge");
		const response = await fetch(`${base}/api/v1/domains`, { headers: auth });
		expect(response.headers.get("content-length")).toBeNull();
		const reader = response.body?.getReader();
		let total = 0;
		while (reader && total <= 6 * 1024 * 1024) {
			const { done, value } = await reader.read();
			if (done) {
				break;
			}
			total += value.byteLength;
		}
		await reader?.cancel();
		expect(total).toBeGreaterThan(5 * 1024 * 1024);
	});

	test("an unknown mode is refused", async () => {
		expect((await setMode("explode")).status).toBe(400);
	});
});

describe("CAPTCHA provider", () => {
	const verifyToken = async (secret: string, response: string) => {
		const result = await fetch(`${base}/__captcha/verify`, {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({ secret, response }),
		});
		return (await result.json()) as { success: boolean; "error-codes"?: string[] };
	};

	test("confirms the solved token with the right secret", async () => {
		expect(await verifyToken(CAPTCHA_SECRET, CAPTCHA_SOLVED_TOKEN)).toEqual({ success: true });
	});

	test("refuses an unsolved token and a wrong secret", async () => {
		expect(await verifyToken(CAPTCHA_SECRET, "nope")).toEqual({
			success: false,
			"error-codes": ["invalid-input-response"],
		});
		expect((await verifyToken("wrong", CAPTCHA_SOLVED_TOKEN)).success).toBe(false);
	});

	test("serves the widget script, which writes the solved token into its named input", async () => {
		const script = await (await fetch(`${base}/__captcha/widget.js`)).text();

		expect(script).toContain(CAPTCHA_FIELD);
		expect(script).toContain(CAPTCHA_SOLVED_TOKEN);
		expect((await fetch(`${base}/__captcha/widget.js`)).headers.get("content-type")).toBe(
			"text/javascript",
		);
	});

	test("logs whether the secret and the token were right, and neither value", async () => {
		await verifyToken("wrong", "nope");
		await verifyToken(CAPTCHA_SECRET, CAPTCHA_SOLVED_TOKEN);

		const entries = (await logged()).filter((entry) => entry.captcha);
		expect(entries.map((entry) => entry.captcha)).toEqual([
			{ secret: "wrong", token: "unsolved" },
			{ secret: "valid", token: "solved" },
		]);
		const dump = JSON.stringify(entries);
		expect(dump).not.toContain(CAPTCHA_SECRET);
		expect(dump).not.toContain(CAPTCHA_SOLVED_TOKEN);
	});

	test("does not touch the API's bearer check", async () => {
		const response = await fetch(`${base}/api/v1/status`);

		expect(response.status).toBe(401);
	});
});
